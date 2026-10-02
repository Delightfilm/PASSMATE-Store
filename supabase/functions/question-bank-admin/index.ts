import { createSupabaseContext } from "npm:@supabase/server@1.7.0";
import { editableContent, loadNasQuestion, validatePatch } from "./question-review.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type JsonRecord = Record<string, unknown>;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uuid(value: unknown) {
  const candidate = text(value);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(candidate)
    ? candidate
    : null;
}

function compactDate(value: unknown) {
  const candidate = text(value).replace(/[^0-9]/g, "");
  if (!/^\d{8}$/.test(candidate)) return null;
  return `${candidate.slice(0, 4)}-${candidate.slice(4, 6)}-${candidate.slice(6, 8)}`;
}

function choiceLabel(index: number) {
  return ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧", "⑨", "⑩"][index] ?? String(index + 1);
}

function normalizeChoices(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      if (typeof item === "string") return { label: choiceLabel(index), text: item.trim() };
      if (!item || typeof item !== "object") return null;
      const record = item as JsonRecord;
      const choiceText = text(record.text ?? record.choice_text ?? record.value);
      if (!choiceText) return null;
      return { label: text(record.label) || choiceLabel(index), text: choiceText };
    })
    .filter((item): item is { label: string; text: string } => Boolean(item?.text));
}

function answerIndex(row: JsonRecord) {
  const explicit = Number(row.answer_no);
  if (Number.isInteger(explicit) && explicit >= 1) return explicit - 1;
  const candidate = Number(row.answer);
  if (!Number.isInteger(candidate)) return null;
  return candidate >= 1 ? candidate - 1 : candidate;
}

function imageUrls(row: JsonRecord) {
  const values: string[] = [];
  for (const key of ["images", "visual_refs"] as const) {
    if (Array.isArray(row[key])) {
      for (const item of row[key] as unknown[]) if (typeof item === "string" && item.trim()) values.push(item.trim());
    }
  }
  if (Array.isArray(row.visual_assets)) {
    for (const item of row.visual_assets) {
      if (!item || typeof item !== "object") continue;
      const sourceUrl = text((item as JsonRecord).source_url);
      if (sourceUrl) values.push(sourceUrl);
    }
  }
  return [...new Set(values)];
}

async function sha256(value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const { data: ctx, error: contextError } = await createSupabaseContext(req, { auth: "user" });
  if (contextError || !ctx?.userClaims?.id) {
    return json(contextError?.status ?? 401, { error: "invalid_session" });
  }

  const { data: profile, error: profileError } = await ctx.supabase
    .from("profiles")
    .select("role")
    .eq("id", ctx.userClaims.id)
    .maybeSingle();
  if (profileError || profile?.role !== "admin") return json(403, { error: "admin_required" });

  let body: JsonRecord;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const admin = ctx.supabaseAdmin;
  const action = text(body.action);
  const actorId = ctx.userClaims.id;

  async function audit(targetId: string, detail: JsonRecord) {
    await admin.from("admin_action_events").insert({
      actor_user_id: actorId,
      action: `question_bank_${action}`,
      target_type: "question_bank_import_batch",
      target_id: targetId,
      detail,
    });
  }

  if (action === "start_import") {
    const qualification = body.qualification as JsonRecord | undefined;
    const exams = Array.isArray(body.examSessions) ? body.examSessions as JsonRecord[] : [];
    const subjects = Array.isArray(body.subjects) ? body.subjects as JsonRecord[] : [];
    const code = text(qualification?.code).toLowerCase();
    const title = text(qualification?.title);
    const fileName = text(body.fileName);
    const expectedQuestions = Number(body.questionCount);

    if (!code || !title || !fileName || !exams.length || exams.length > 500 || subjects.length > 100) {
      return json(400, { error: "invalid_import_manifest" });
    }

    const { data: cert, error: certError } = await admin
      .from("question_bank_certs")
      .upsert({ code, name: title, source_url: text(qualification?.source_url) || null, updated_at: new Date().toISOString() }, { onConflict: "code" })
      .select("id")
      .single();
    if (certError || !cert) return json(500, { error: "cert_upsert_failed" });

    if (subjects.length) {
      const rows = subjects.map((subject) => ({
        cert_id: cert.id,
        external_id: text(subject.subject_id),
        part_number: Number.isInteger(Number(subject.part_number)) ? Number(subject.part_number) : null,
        name: text(subject.name) || text(subject.subject_id),
        updated_at: new Date().toISOString(),
      })).filter((subject) => subject.external_id && subject.name);
      const { error } = await admin.from("question_bank_subjects").upsert(rows, { onConflict: "cert_id,external_id" });
      if (error) return json(500, { error: "subject_upsert_failed" });
    }

    const examRows = exams.map((exam) => {
      const year = Number(exam.year);
      const roundValue = text(exam.round) || String(exam.round ?? "");
      const round = roundValue.endsWith("회") ? roundValue : `${roundValue}회`;
      const examTitle = text(exam.title);
      return {
        cert_id: cert.id,
        external_id: text(exam.exam_id),
        exam_date: compactDate(exam.exam_date),
        year,
        round,
        title: examTitle && examTitle !== title ? examTitle : `${title} ${year}년 ${round}`,
        source_url: text(exam.source_url) || null,
        duration_minutes: Number.isInteger(Number(exam.duration_minutes)) ? Number(exam.duration_minutes) : 60,
        pass_score: Number.isFinite(Number(exam.pass_score)) ? Number(exam.pass_score) : 60,
        metadata: {
          round_source: exam.round_source ?? null,
          round_confidence: exam.round_confidence ?? null,
        },
        updated_at: new Date().toISOString(),
      };
    }).filter((exam) => exam.external_id && Number.isInteger(exam.year));
    if (examRows.length !== exams.length) return json(400, { error: "invalid_exam_manifest" });
    const { error: examError } = await admin.from("question_bank_exams").upsert(examRows, { onConflict: "cert_id,external_id" });
    if (examError) return json(500, { error: "exam_upsert_failed" });

    const { data: batch, error: batchError } = await admin
      .from("question_bank_import_batches")
      .insert({
        file_name: fileName,
        schema_version: text(body.schemaVersion) || null,
        qualification_code: code,
        status: "importing",
        created_by: actorId,
        metadata: { expected_questions: Number.isInteger(expectedQuestions) ? expectedQuestions : null },
      })
      .select("id")
      .single();
    if (batchError || !batch) return json(500, { error: "batch_create_failed" });
    await audit(batch.id, { file_name: fileName, expected_questions: expectedQuestions });
    return json(200, { batchId: batch.id });
  }

  if (action === "import_chunk") {
    const batchId = uuid(body.batchId);
    const questions = Array.isArray(body.questions) ? body.questions as JsonRecord[] : [];
    if (!batchId || !questions.length || questions.length > 100) {
      return json(400, { error: "invalid_import_chunk" });
    }

    const { data: batch } = await admin
      .from("question_bank_import_batches")
      .select("id,qualification_code,status")
      .eq("id", batchId)
      .maybeSingle();
    if (!batch || batch.status !== "importing") return json(409, { error: "batch_not_importing" });

    const { data: cert } = await admin
      .from("question_bank_certs")
      .select("id")
      .eq("code", batch.qualification_code)
      .single();
    if (!cert) return json(500, { error: "batch_cert_missing" });

    const [{ data: exams }, { data: subjects }] = await Promise.all([
      admin.from("question_bank_exams").select("id,external_id").eq("cert_id", cert.id),
      admin.from("question_bank_subjects").select("id,external_id").eq("cert_id", cert.id),
    ]);
    const examMap = new Map((exams ?? []).map((exam) => [exam.external_id, exam.id]));
    const subjectMap = new Map((subjects ?? []).map((subject) => [subject.external_id, subject.id]));
    const rows: JsonRecord[] = [];
    const errors: { index: number; questionUid: string; message: string }[] = [];

    for (let index = 0; index < questions.length; index += 1) {
      const question = questions[index];
      const questionUid = text(question.question_uid);
      const examExternalId = text(question.exam_id);
      const examId = examMap.get(examExternalId);
      const questionNo = Number(question.question_no ?? question.no);
      const stem = text(question.stem ?? question.question);
      const choices = normalizeChoices(question.choices);
      const answer = answerIndex(question);
      if (!questionUid || !examId || !Number.isInteger(questionNo) || questionNo < 1 || !stem || choices.length < 2 || answer === null || answer < 0 || answer >= choices.length) {
        errors.push({ index, questionUid, message: "required_question_field_invalid" });
        continue;
      }
      const sourceHash = text(question.sourceHash ?? question.source_hash ?? question.content_hash) || await sha256({ stem, choices, answer });
      rows.push({
        exam_id: examId,
        cert_id: cert.id,
        subject_id: subjectMap.get(text(question.subject_id)) ?? null,
        no: questionNo,
        stem,
        images: imageUrls(question),
        choices,
        answer,
        explanation: text(question.explanation),
        status: "needs_review",
        source_hash: sourceHash,
        source_question_uid: questionUid,
        source_uid: text(question.source_uid) || null,
        source_page: Number.isInteger(Number(question.source_page)) ? Number(question.source_page) : null,
        answer_status: text(question.answer_status) || null,
        review_status: text(question.review_status) || null,
        metadata: {
          canonical_uid: question.canonical_uid ?? null,
          correct_choice_text: question.correct_choice_text ?? null,
          answer_confidence: question.answer_confidence ?? null,
          needs_visual_review: question.needs_visual_review ?? false,
          visual_assets: question.visual_assets ?? [],
          tags: question.tags ?? {},
          concepts: question.concepts ?? [],
          difficulty: question.difficulty ?? null,
          difficulty_score: question.difficulty_score ?? null,
        },
        import_batch_id: batchId,
        updated_at: new Date().toISOString(),
      });
    }

    if (rows.length) {
      const { error } = await admin
        .from("question_bank_questions")
        .upsert(rows, { onConflict: "import_batch_id,source_question_uid" });
      if (error) {
        console.error("question bank chunk insert failed", error.code);
        return json(500, { error: "question_chunk_insert_failed" });
      }
    }

    const { count } = await admin
      .from("question_bank_questions")
      .select("id", { count: "exact", head: true })
      .eq("import_batch_id", batchId);
    await admin.from("question_bank_import_batches").update({ row_count: count ?? 0 }).eq("id", batchId);
    return json(200, { imported: rows.length, errors, totalImported: count ?? 0 });
  }

  if (action === "finish_import") {
    const batchId = uuid(body.batchId);
    if (!batchId) return json(400, { error: "invalid_batch_id" });
    const errorCount = Math.max(0, Number(body.errorCount) || 0);
    const { data, error } = await admin
      .from("question_bank_import_batches")
      .update({ status: "needs_review", error_count: errorCount, completed_at: new Date().toISOString() })
      .eq("id", batchId)
      .eq("status", "importing")
      .select("id,row_count,error_count,status")
      .single();
    if (error || !data) return json(409, { error: "batch_finish_failed" });
    await audit(batchId, { row_count: data.row_count, error_count: data.error_count });
    return json(200, { batch: data });
  }

  if (action === "publish_batch") {
    const batchId = uuid(body.batchId);
    if (!batchId) return json(400, { error: "invalid_batch_id" });
    const { data, error } = await admin.rpc("question_bank_publish_batch", { p_batch_id: batchId });
    if (error) return json(409, { error: "batch_publish_failed" });
    await audit(batchId, { published_questions: data });
    return json(200, { published: data });
  }

  if (action === "rollback_batch") {
    const batchId = uuid(body.batchId);
    if (!batchId) return json(400, { error: "invalid_batch_id" });
    const now = new Date().toISOString();
    const { error: questionError } = await admin
      .from("question_bank_questions")
      .update({ status: "draft", updated_at: now })
      .eq("import_batch_id", batchId);
    const { error: batchError } = await admin
      .from("question_bank_import_batches")
      .update({ status: "rolled_back", rolled_back_at: now })
      .eq("id", batchId);
    if (questionError || batchError) return json(500, { error: "batch_rollback_failed" });
    await audit(batchId, {});
    return json(200, { rolledBack: true });
  }

  if (action === "recent_batches") {
    const { data, error } = await admin
      .from("question_bank_import_batches")
      .select("id,file_name,schema_version,qualification_code,status,row_count,error_count,created_at,completed_at,published_at")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return json(500, { error: "batch_list_failed" });
    return json(200, { batches: data ?? [] });
  }

  if (action === "list_reports") {
    const { data, error } = await admin
      .from("question_bank_issue_reports")
      .select("id,question_id,question_ref,qualification_code,attempt_id,kind,memo,status,created_at,question_bank_questions(no,stem)")
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return json(500, { error: "report_list_failed" });
    return json(200, { reports: data ?? [] });
  }

  if (action === "list_review_history") {
    const authorization = await admin.rpc("authorize_question_bank_review", { p_actor: actorId });
    if (authorization.error) return json(403, { error: "admin_access_required" });
    const { data, error } = await admin.from("question_bank_review_events").select("id,report_id,question_ref,qualification_code,actor_user_id,action,reason,before_content,after_content,created_at").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(100);
    if (error) return json(500, { error: "review_history_failed" });
    return json(200, { events: data ?? [] });
  }

  if (["get_report_question", "save_report_question", "resolve_report"].includes(action)) {
    const authorization = await admin.rpc("authorize_question_bank_review", { p_actor: actorId });
    if (authorization.error) return json(403, { error: "admin_access_required" });
    const reportId = text(body.reportId);
    if (!reportId) return json(400, { error: "invalid_report_id" });
    if (action === "resolve_report") {
      const { data, error } = await admin.rpc("review_question_bank_report", { p_actor: actorId, p_report_id: reportId, p_resolve: true, p_reason: text(body.reason) });
      if (error) return json(error.code === "42501" ? 403 : 409, { error: error.message });
      return json(200, data);
    }
    const { data: report, error: reportError } = await admin.from("question_bank_issue_reports").select("*").eq("id", reportId).maybeSingle();
    if (reportError) return json(500, { error: "report_load_failed" });
    if (!report) return json(404, { error: "report_not_found" });
    if (report.status !== "open") return json(409, { error: "report_already_resolved" });
    try {
      let source: Record<string, unknown>;
      let code = text(report.qualification_code) || text(body.qualificationCode);
      if (report.question_ref) {
        if (!code && report.user_id && report.attempt_id) {
          const { data: attempt, error } = await admin.from("question_bank_attempts").select("config").eq("user_id", report.user_id).eq("client_id", report.attempt_id).maybeSingle();
          if (error) throw new Error("question_context_failed");
          code = text(attempt?.config?.certId);
        }
        if (!code) throw new Error("question_qualification_required");
        source = await loadNasQuestion(code, report.question_ref);
      } else {
        const { data: question, error } = await admin.from("question_bank_questions").select("id,cert_id,no,stem,images,choices,answer,explanation,source_hash").eq("id", report.question_id).maybeSingle();
        if (error || !question) throw new Error("question_not_found");
        code = question.cert_id;
        source = { ...question, sourceHash: question.source_hash };
      }
      const ref = report.question_ref || report.question_id;
      const { data: correction, error: correctionError } = await admin.from("question_bank_question_corrections").select("content,version,source_hash").eq("question_ref", ref).maybeSingle();
      if (correctionError) throw new Error("question_correction_load_failed");
      const sourceHash = text(source.sourceHash);
      if (correction && correction.source_hash !== sourceHash) throw new Error("question_source_changed");
      if (action === "get_report_question") return json(200, { question: { id: ref, certId: code, no: source.no, images: source.images, ...editableContent(correction?.content || source) }, version: correction?.version || 0, sourceHash });
      validatePatch(body.patch);
      const patch = editableContent(body.patch as Record<string, unknown>);
      if (!Number.isInteger(body.expectedVersion) || !text(body.reason) || text(body.reason).length > 2000) throw new Error("invalid_question_patch");
      if (text(body.sourceHash) !== sourceHash) throw new Error("question_source_changed");
      const { data, error } = await admin.rpc("review_question_bank_report", {
        p_actor: actorId, p_report_id: reportId, p_resolve: body.resolve === true,
        p_patch: patch, p_source: editableContent(source), p_qualification_code: code,
        p_source_hash: sourceHash, p_expected_version: body.expectedVersion, p_reason: text(body.reason),
      });
      if (error) return json(error.code === "42501" ? 403 : 409, { error: error.message });
      return json(200, data);
    } catch (error) {
      const message = error instanceof Error ? error.message : "question_review_failed";
      return json(message.includes("conflict") || message.includes("changed") ? 409 : 400, { error: message });
    }
  }

  return json(400, { error: "invalid_action" });
});
