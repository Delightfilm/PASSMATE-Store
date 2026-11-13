export type LearningExample = {
  id: string; concept: string; question: string; assumption: string; formula: string;
  steps: string[]; answer: string; mistake: string; sourceIds: string[];
  result: { value: number; unit: string };
};
type LearningGuide = {
  slug: string; title: string; description: string; introduction: string;
  approach: string[]; checkpoints: string[];
  questions: { id: string; question: string; answer: string; exampleId: string; sourceIds: string[] }[];
  sources: { id: string; label: string; href: string }[]; examples: LearningExample[];
};
export const learningGuideCheckedAt = "2026-11-13";
export function learningGuideHref(slug: string) { return `/cbt/${encodeURIComponent(slug)}/guide/`; }
const physics = "https://openstax.org/books/university-physics-volume-";

export const learningGuides: LearningGuide[] = [
  {
    slug: "전기기능사",
    title: "전기기능사 필기 공부 방법과 개념 풀이 예시",
    description: "전기기능사 필기 기출을 복습하는 순서와 옴의 법칙·병렬저항·전력량의 자체 제작 풀이 예시를 확인하고 회차별 문제풀이로 이어가세요.",
    introduction: "전기기능사 기출을 풀 때는 정답 번호와 함께 공식의 적용 조건, 단위, 회로의 연결을 확인해 보세요. 여기서는 전기 계산의 출발점인 전류·저항·전력량을 세 가지 예시로 연습합니다.",
    approach: [
      "한 회차를 풀고 틀린 문제를 계산·기기 원리·설비와 규정으로 나눕니다. 처음 점수는 복습할 범위를 찾는 자료로 사용하세요.",
      "계산 문제에서는 주어진 물리량과 구할 값을 먼저 적고, 식에 넣기 전에 V·A·Ω·W·시간 단위를 맞춥니다. 회로 그림에서 직렬과 병렬을 구별하는 과정도 남깁니다.",
      "같은 개념을 다른 수치로 다시 계산한 뒤 회차별 기출이나 모의시험으로 돌아갑니다. 설비·규정은 기출 당시 내용과 준비하는 시험의 현행 출제기준을 구분하세요.",
    ],
    checkpoints: ["직렬에서는 같은 전류, 병렬에서는 같은 전압이 걸리는지 확인하기", "전력 W와 전력량 Wh·kWh를 구분하기", "법규·설비의 과거 정답을 현행 기준으로 바로 적용하지 않기"],
    questions: [
      { id: "electric-parallel-why", question: "병렬 합성저항은 왜 가장 작은 저항보다 작나요?", answer: "양의 저항이 같은 두 지점에 병렬로 연결되면 전류가 흐를 경로가 늘어납니다. 합성저항의 역수는 각 저항 역수의 합이므로, 두 저항 이상에서는 합성저항이 각 저항보다 작습니다. 반면 직렬은 저항값을 더합니다. 회로의 두 접속점을 먼저 확인한 뒤 식을 선택하세요.", exampleId: "electric-parallel", sourceIds: ["resistors"] },
      { id: "electric-energy-units", question: "W와 Wh·kWh는 어떻게 구분하나요?", answer: "W는 단위 시간에 전달되는 에너지인 전력, Wh와 kWh는 사용 시간까지 반영한 에너지인 전력량입니다. 전력이 일정하면 전력량은 전력과 시간의 곱입니다. kW에 시간을 h로 넣어야 kWh가 되므로, 30분은 0.5시간으로 바꿔 계산합니다.", exampleId: "electric-energy", sourceIds: ["power"] },
    ],
    sources: [
      { id: "ohm", label: "OpenStax University Physics 2 — Ohm’s Law", href: `${physics}2/pages/9-4-ohms-law` },
      { id: "resistors", label: "OpenStax University Physics 2 — Resistors in Series and Parallel", href: `${physics}2/pages/10-2-resistors-in-series-and-parallel` },
      { id: "power", label: "OpenStax University Physics 2 — Electrical Energy and Power", href: `${physics}2/pages/9-5-electrical-energy-and-power` },
    ],
    examples: [
      { id: "electric-ohm", concept: "옴의 법칙과 전류", question: "20 Ω 저항 양단에 120 V가 걸릴 때 저항에 흐르는 전류는 얼마일까요?", assumption: "저항이 일정한 이상적인 저항 소자이며, 주어진 전압이 그 저항 양단의 전압이라고 가정합니다.", formula: "I = V / R", steps: ["구할 값은 전류 I이고, 전압 V = 120 V, 저항 R = 20 Ω입니다.", "I = 120 / 20 = 6이므로 단위를 붙이면 6 A입니다. V = IR에 다시 넣으면 6 × 20 = 120 V로 확인됩니다."], answer: "6 A", mistake: "전압과 저항을 곱하면 전류가 되지 않습니다. 구할 값에 맞게 식을 먼저 정리하세요.", sourceIds: ["ohm"], result: { value: 6, unit: "A" } },
      { id: "electric-parallel", concept: "병렬저항의 합성", question: "12 Ω과 6 Ω 저항을 병렬로 연결했을 때 합성저항은 얼마일까요?", assumption: "두 저항의 양쪽 단자가 각각 같은 두 지점에 연결된 이상적인 병렬회로입니다.", formula: "1 / R = 1 / R₁ + 1 / R₂", steps: ["1/R = 1/12 + 1/6 = 3/12 = 1/4입니다.", "이 값은 합성저항의 역수이므로 R = 4 Ω입니다. 병렬 합성저항이 가장 작은 저항 6 Ω보다 작다는 점도 확인합니다."], answer: "4 Ω", mistake: "역수를 더한 1/4을 그대로 저항값으로 쓰지 마세요. 직렬처럼 12 + 6을 계산하는 경우와도 구분합니다.", sourceIds: ["resistors"], result: { value: 4, unit: "Ω" } },
      { id: "electric-energy", concept: "전력과 전력량", question: "46 Ω의 순저항에 실효값 230 V를 걸고 30분 동안 같은 조건을 유지하면 소비 전력량은 몇 kWh일까요?", assumption: "교류에서 역률이 1인 순저항이며 저항값 변화와 기타 손실을 무시합니다. 실제 기기를 연결하는 작업 지침이 아닌 계산 예시입니다.", formula: "P = V² / R, E = P × t", steps: ["전력은 230² / 46 = 1,150 W = 1.15 kW입니다.", "30분을 0.5시간으로 바꾸면 전력량은 1.15 × 0.5 = 0.575 kWh입니다."], answer: "0.575 kWh", mistake: "1,150 W는 전력이고 0.575 kWh는 사용 시간까지 반영한 전력량입니다. 분을 시간으로 바꾸는 단계를 빠뜨리지 마세요.", sourceIds: ["ohm", "power"], result: { value: 0.575, unit: "kWh" } },
    ],
  },
  {
    slug: "지게차운전기능사",
    title: "지게차운전기능사 필기 공부 방법과 기초 계산 예시",
    description: "지게차운전기능사 필기 기출의 복습 순서와 유압·모멘트·일률의 자체 제작 기초 계산 예시를 확인하세요. 과거 기출과 현행 기준을 구분해 학습합니다.",
    introduction: "지게차 필기는 장치의 이름을 외우는 데서 그치지 않고 힘이 전달되는 원리, 부품의 역할, 작업 조건을 연결해 복습해 보세요. 이 페이지의 세 계산은 유압과 기초 역학을 이해하기 위한 이상적인 모형입니다.",
    approach: [
      "먼저 한 회차를 풀어 모르는 용어와 헷갈리는 장치의 역할을 적습니다. 현재 제공하는 이 종목의 자료는 과목 구분이 없으므로 오답 원인을 직접 분류해 보세요.",
      "유압·동력 계통은 압력, 힘, 면적, 일과 일률을 나누어 봅니다. 계산에서 구한 이상적인 값과 실제 장비의 정격·제조사 지침을 구분합니다.",
      "회차별 복습 후 모의시험으로 다시 확인하고, 안전·법규 문제는 준비하는 시험에 적용되는 공식 자료로 대조합니다. 필기 연습과 실제 장비 운전 교육은 별개입니다.",
    ],
    checkpoints: ["cm²를 m²로 바꾸거나 면적비를 사용할 때 같은 단위인지 확인하기", "모멘트의 거리는 힘의 작용선까지의 수직거리로 읽기", "이상적인 계산값을 실제 허용하중이나 운전 기준으로 사용하지 않기"],
    questions: [
      { id: "forklift-pressure-force", question: "유압 계산에서 압력과 힘은 무엇이 다른가요?", answer: "압력은 단위 면적에 작용하는 힘으로 P = F/A입니다. 같은 압력이 전달되는 이상적인 유압 모형에서는 피스톤 면적이 커지면 힘도 커집니다. 출력 면적이 입력의 5배라고 해서 압력이 5배가 되는 것은 아닙니다. 실제 장비의 허용하중과 안전 조건은 이 모형만으로 판단할 수 없습니다.", exampleId: "forklift-hydraulic", sourceIds: ["hydraulics"] },
      { id: "forklift-work-power", question: "일과 일률 문제에서는 무엇부터 확인하나요?", answer: "일은 힘이 작용한 방향의 이동거리까지 반영한 에너지이고, 평균 일률은 그 일을 걸린 시간으로 나눈 값입니다. 먼저 구할 단위가 J인지 W인지 확인하세요. 힘과 이동 방향이 같은 일정한 힘의 모형에서는 일 = 힘 × 이동거리, 평균 일률 = 일 ÷ 시간으로 계산합니다.", exampleId: "forklift-work", sourceIds: ["work", "power"] },
    ],
    sources: [
      { id: "hydraulics", label: "OpenStax University Physics 1 — Pascal’s Principle and Hydraulics", href: `${physics}1/pages/14-3-pascals-principle-and-hydraulics` },
      { id: "torque", label: "OpenStax University Physics 1 — Torque", href: `${physics}1/pages/10-6-torque` },
      { id: "work", label: "OpenStax University Physics 1 — Work", href: `${physics}1/pages/7-1-work` },
      { id: "power", label: "OpenStax University Physics 1 — Power", href: `${physics}1/pages/7-4-power` },
    ],
    examples: [
      { id: "forklift-hydraulic", concept: "유압과 면적비", question: "입력 피스톤 면적이 2 cm², 출력 피스톤 면적이 10 cm²인 이상적인 유압 모형에 120 N을 가하면 출력 힘은 얼마일까요?", assumption: "유체가 정지해 있고 두 피스톤의 높이가 같으며 마찰과 압력 손실을 무시합니다.", formula: "F₁ / A₁ = F₂ / A₂", steps: ["출력과 입력의 면적비는 10/2 = 5입니다. 같은 cm² 단위를 사용한 비이므로 단위가 소거됩니다.", "F₂ = 120 × 5 = 600 N입니다. 힘이 커지는 만큼 이동거리는 달라지므로 에너지가 새로 생기는 것은 아닙니다."], answer: "600 N", mistake: "출력 힘과 압력은 같은 양이 아닙니다. 출력 피스톤이 크다는 이유로 동일한 모형 안의 압력까지 5배라고 계산하지 마세요.", sourceIds: ["hydraulics"], result: { value: 600, unit: "N" } },
      { id: "forklift-moment", concept: "힘과 모멘트", question: "회전축에서 힘의 작용선까지의 수직거리가 2 m이고 힘이 100 N일 때 모멘트의 크기는 얼마일까요?", assumption: "고정된 한 회전축에 대한 단일 힘의 모멘트 크기만 계산합니다. 실제 지게차의 안정도나 허용하중 계산이 아닙니다.", formula: "M = F × d", steps: ["d는 축에서 아무 점까지의 거리가 아니라 힘의 작용선까지의 수직거리 2 m입니다.", "M = 100 × 2 = 200 N·m입니다. 같은 힘에서 수직거리가 커지면 모멘트도 커집니다."], answer: "200 N·m", mistake: "질량 kg를 힘 N과 바로 혼용하지 마세요. 모멘트 단위 N·m와 일의 단위 J가 차원은 같아도 묻는 물리량은 다릅니다.", sourceIds: ["torque"], result: { value: 200, unit: "N·m" } },
      { id: "forklift-work", concept: "일과 평균 일률", question: "일정한 힘 1,000 N이 힘과 같은 방향으로 0.2 m 이동하며 5초 동안 일을 했다면 평균 일률은 얼마일까요?", assumption: "힘이 일정하고 변위와 같은 방향이며 손실을 무시합니다. 모형의 계산값을 장비의 실제 정격으로 해석하지 않습니다.", formula: "W = F × s, P = W / t", steps: ["일은 W = 1,000 × 0.2 = 200 J입니다.", "평균 일률은 200 J / 5 s = 40 W입니다. 같은 일을 더 긴 시간에 하면 평균 일률은 작아집니다."], answer: "40 W", mistake: "200 J는 한 일의 양이고 40 W는 단위 시간당 한 일입니다. 힘 1,000 N을 일률로 답하지 마세요.", sourceIds: ["work", "power"], result: { value: 40, unit: "W" } },
    ],
  },
  {
    slug: "무대음향-3급",
    title: "무대음향 3급 공부 방법과 dBu·dBV·데시벨 풀이",
    description: "무대음향 3급 공부 순서, dBu·dBV와 10log·20log의 차이를 확인하세요. 신호 전압·데시벨·샘플링·전달 시간의 자체 제작 예시에서 기출 문제풀이로 이어집니다.",
    introduction: "무대음향 3급은 음향 용어를 신호와 장비의 관계 속에서 이해하며 공부해 보세요. dBu·dBV의 전압 기준, 음압과 강도의 데시벨 계산을 구분하고 디지털 샘플링·전달 시간까지 네 가지 예시로 연습합니다.",
    approach: [
      "응시하려는 3급의 회차와 자료 범위를 먼저 확인합니다. 공연장 안전과 관련 법규, 무대기술일반, 음향 개념을 구분하며 틀린 이유를 적습니다.",
      "마이크에서 입력·처리·증폭·출력으로 이어지는 신호 흐름에 용어를 연결해 보세요. 디지털 오디오의 Hz와 시간, 신호 레벨의 dB를 서로 다른 단위로 구분합니다.",
      "수치가 달라진 개념 예시를 다시 푼 뒤 기출로 돌아갑니다. 다른 급수는 보충 자료로 사용하되 3급의 시험 범위와 같다고 가정하지 않고 공식 시험 안내를 확인합니다.",
    ],
    checkpoints: ["압력비와 강도비의 데시벨 계산을 구분하기", "샘플링 주파수와 보존하려는 신호의 주파수를 구분하기", "거리차에 의한 전달 시간과 장비의 처리 지연을 구분하기"],
    questions: [
      { id: "audio-dbu-dbv", question: "dBu와 dBV의 차이는 무엇인가요?", answer: "둘 다 신호의 실효 전압을 기준 전압과 비교한 레벨이지만 기준값이 다릅니다. 제조사 자료에서 0 dBu는 0.775 V RMS, 0 dBV는 1 V RMS입니다. dBu = 20 log₁₀(V/0.775), dBV = 20 log₁₀(V/1)로 구분합니다. 같은 숫자라도 같은 전압은 아니며, 아래 예시는 반올림한 기준값 0.775 V를 사용합니다.", exampleId: "audio-reference-voltage", sourceIds: ["voltage-reference", "audio-level-units"] },
      { id: "audio-ten-twenty-log", question: "데시벨 계산에서 10log와 20log는 언제 쓰나요?", answer: "전력이나 음향 강도의 비는 10 log₁₀로, 같은 매질·조건에서 음압의 비는 20 log₁₀로 표현합니다. 강도가 음압의 제곱에 비례하기 때문입니다. 전압비를 전력비와 연결할 때도 임피던스 조건을 확인해야 합니다. 먼저 문제에서 비교하는 값이 음압·전압인지, 전력·강도인지 구분하세요.", exampleId: "audio-level", sourceIds: ["sound-level", "audio-level-units"] },
      { id: "audio-dbu-dbfs", question: "dBu를 dBFS로 바로 바꿀 수 있나요?", answer: "장비의 아날로그 전압과 디지털 풀스케일 대응을 모르면 바로 바꿀 수 없습니다. 예를 들어 해당 장비가 0 dBFS를 +24 dBu에 맞춘 조건이라면 +4 dBu는 그보다 20 dB 낮은 −20 dBFS에 대응합니다. 이 대응은 장비의 정렬 조건이며 모든 장비에 같은 값으로 적용할 수 없습니다.", exampleId: "audio-reference-voltage", sourceIds: ["digital-levels"] },
    ],
    sources: [
      { id: "sound-level", label: "OpenStax University Physics 1 — Sound Intensity", href: `${physics}1/pages/17-3-sound-intensity` },
      { id: "voltage-reference", label: "Yamaha EMX7/EMX5 — Specifications", href: "https://usa.yamaha.com/business/audio/products/mixers/emx7-emx5/specs.html" },
      { id: "audio-level-units", label: "Biamp — Gain structure: input and output levels", href: "https://support.biamp.com/General/Audio/Gain_structure:_input_and_output_levels" },
      { id: "digital-levels", label: "Yamaha — 아날로그·디지털 레벨의 차이", href: "https://jp.yamaha.com/business/audio/explore/featured-contents/mailmagazine/archive/tips08.html" },
      { id: "sampling", label: "Analog Devices — Sampling Rate", href: "https://www.analog.com/en/resources/glossary/sampling-rate.html" },
      { id: "aliasing", label: "Analog Devices — Mixed-Signal Components, Part V", href: "https://www.analog.com/en/resources/analog-dialogue/articles/mixed-signal-components-for-digital-communications-systems-part-v.html" },
      { id: "sound-waves", label: "OpenStax University Physics 1 — Sound Waves", href: `${physics}1/pages/17-1-sound-waves` },
    ],
    examples: [
      { id: "audio-level", concept: "압력비와 데시벨", question: "같은 매질·조건에서 음압의 실효값이 기존의 3배가 되면 음압 레벨의 차이는 약 몇 dB일까요?", assumption: "비교하는 음압은 같은 종류의 실효값이며 같은 기준 음압을 사용합니다. 청감상의 크기나 안전한 노출 수준을 계산하는 문제가 아닙니다.", formula: "ΔL = 20 log₁₀(p₂ / p₁)", steps: ["음압비가 3이므로 20 × log₁₀(3)을 계산합니다.", "log₁₀(3) ≈ 0.4771이므로 차이는 약 9.54 dB입니다. 같은 조건에서 음향 강도는 음압의 제곱에 비례하므로 10 log₁₀(9)로도 같은 결과를 확인할 수 있습니다."], answer: "약 9.54 dB", mistake: "강도가 3배라는 문제라면 10 log₁₀(3) ≈ 4.77 dB입니다. 음압과 강도 중 무엇의 비율인지 먼저 확인하세요.", sourceIds: ["sound-level"], result: { value: 9.542425, unit: "dB" } },
      { id: "audio-reference-voltage", concept: "dBu 기준과 실효 전압", question: "0 dBu의 기준을 0.775 V RMS로 사용할 때 +4 dBu 신호의 실효 전압은 약 몇 V일까요?", assumption: "제조사 표기의 반올림한 기준 전압 0.775 V RMS와 전압 레벨 정의를 사용합니다. 출력 전력·부하·장비 설정을 구하는 문제가 아닙니다.", formula: "V = 0.775 × 10^(L_dBu / 20)", steps: ["레벨 +4 dBu를 넣으면 V = 0.775 × 10^(4/20)입니다.", "10^0.2 ≈ 1.5849이므로 V ≈ 0.775 × 1.5849 = 1.2283 V RMS, 약 1.23 V RMS입니다. 20 log₁₀(1.2283/0.775)로 되돌리면 약 4 dBu입니다."], answer: "약 1.23 V RMS", mistake: "dBu의 숫자 4를 전압 4 V로 읽거나 dBV의 기준 1 V를 그대로 넣지 마세요. dBFS와의 대응은 장비의 정렬 조건이 별도로 필요합니다.", sourceIds: ["voltage-reference", "audio-level-units"], result: { value: 1.2282925, unit: "V RMS" } },
      { id: "audio-sampling", concept: "샘플링과 에일리어싱", question: "48 kHz로 이상적으로 샘플링할 때, 필터링되지 않은 30 kHz 단일 정현파는 기본 대역에서 어떤 주파수와 구별되지 않을까요?", assumption: "기저대역 샘플링의 이상적인 모형이며 입력의 30 kHz 성분을 제거하는 사전 필터가 없다고 가정합니다.", formula: "f_alias = |f_s − f|", steps: ["샘플링 주파수 48 kHz의 절반인 24 kHz가 나이퀴스트 주파수입니다. 30 kHz는 이를 넘습니다.", "이 경우 48 − 30 = 18 kHz, 즉 18,000 Hz 성분으로 접혀 나타납니다. 실제 변환에서는 필요한 대역 밖 성분을 샘플링 전에 억제하도록 필터를 고려합니다."], answer: "18,000 Hz (18 kHz)", mistake: "48 kHz 샘플링이 48 kHz까지의 신호를 그대로 보존한다는 뜻은 아닙니다. 실제 필터의 전이 대역도 있으므로 이론적 경계 24 kHz까지 무조건 보존된다고 보지 마세요.", sourceIds: ["sampling", "aliasing"], result: { value: 18000, unit: "Hz" } },
      { id: "audio-delay", concept: "거리차와 전달 시간", question: "두 소리 경로의 거리차가 10.29 m이고 계산용 음속이 343 m/s로 주어지면 경로차에 의한 시간차는 몇 ms일까요?", assumption: "같은 일정한 음속의 매질을 통과하며 장비 처리 지연과 반사를 무시합니다. 실제 공연장 정렬값을 지정하는 예시는 아닙니다.", formula: "Δt = Δd / c", steps: ["시간차는 10.29 / 343 = 0.03 s입니다.", "1 s = 1,000 ms이므로 0.03 × 1,000 = 30 ms입니다. 실제 시스템을 판단할 때는 거리뿐 아니라 장비 지연과 측정 조건도 구분해야 합니다."], answer: "30 ms", mistake: "0.03 s를 0.03 ms로 쓰지 마세요. 음속은 항상 343 m/s로 고정된 상수가 아니라 이 계산에서 주어진 조건입니다.", sourceIds: ["sound-waves"], result: { value: 30, unit: "ms" } },
    ],
  },
];

export function findLearningGuide(value: string) {
  try { const slug = decodeURIComponent(value); return learningGuides.find(guide => guide.slug === slug); }
  catch { return undefined; }
}
