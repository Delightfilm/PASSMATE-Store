# PASSMATE V2 Customer Auth Flow

## Scope

V2는 고객 계정과 구매자료 조회까지 담당한다.

- 이메일/비밀번호 회원가입
- 이메일/비밀번호 로그인
- 비밀번호 재설정
- 내 계정
- 내 자료
- own-row RLS

결제 생성과 다운로드 URL 발급은 V3/V5에서 처리한다.

## Architecture

정적 Next.js export를 유지하며 Supabase Auth는 브라우저에서 동작한다.

```text
Browser
  ├─ Supabase Auth
  ├─ profiles (own row)
  └─ entitlements (own rows)
       ├─ products metadata
       └─ product_versions metadata
```

브라우저에는 Supabase publishable key만 들어간다. service-role credential은 절대 브라우저/GitHub public config에 넣지 않는다.

## Signup

```text
/account/signup/
→ signUp(email, password, metadata.name)
→ auth.users
→ on_auth_user_created trigger
→ public.profiles
→ email confirmation (project setting dependent)
→ /account/login/?confirmed=1
```

## Login

```text
/account/login/
→ signInWithPassword()
→ session persisted in browser
→ requested next path or /library/
```

`next` 값은 사이트 내부의 절대 path만 허용해 open redirect를 막는다.

## Password reset

```text
/account/forgot-password/
→ resetPasswordForEmail()
→ email link
→ /account/reset-password/
→ updateUser(password)
→ sign out
→ login
```

## Library

로그인하지 않은 사용자가 `/library/`에 접근하면 `/account/login/?next=/library/`로 이동한다.

로그인 사용자는 자신의 active entitlement만 조회한다.

상품이 판매 중단된 후에도 기존 구매자는 상품명/버전 metadata를 볼 수 있어야 하므로 migration 0006에서 owned-product metadata RLS를 추가한다.

## Supabase Auth URL configuration

Production 검증 전 Supabase Auth URL 설정에 최소 다음 경로가 허용되어야 한다.

- Site URL: `https://passmate-store.vercel.app`
- Redirect: `https://passmate-store.vercel.app/account/login/*`
- Redirect: `https://passmate-store.vercel.app/account/reset-password/*`

## Exit Gate

- 회원가입 성공
- 이메일 확인 흐름 확인
- 로그인/로그아웃 성공
- 비밀번호 재설정 성공
- profile display_name 수정 성공
- 다른 사용자의 profile/order/entitlement 조회 불가
- 본인 entitlement만 내 자료에 표시
- Production static export에서 새로고침 후 session 유지
