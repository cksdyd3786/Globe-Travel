# 지구본 여행일지 API 명세서

Oct 1, 2026 · @깡통

## 공통 규칙

요구사항 명세서 버전 1.3과 DB 설계서 버전 1.2를 기준으로 한 MVP API다. 표마다 요구사항 ID를 달아 빠진 기능이 없는지 추적한다.

- **기본 주소**: `/api/v1`. 버전은 경로에 둔다.
- **형식**: 요청·응답 본문은 JSON이고, 사진 업로드만 multipart/form-data다. 필드 이름은 camelCase. 날짜는 `2025-04-12`, 시각은 UTC ISO-8601(`2025-04-12T03:15:00Z`).
- **인증**: 로그인하면 서버가 세션을 만들고 세션 ID를 쿠키(HttpOnly, Secure, SameSite=Lax)로 준다. 가입, 로그인, 중복 확인을 뺀 모든 API는 로그인이 필요하다(NFR-06). 상태를 바꾸는 요청에는 CSRF 토큰 헤더를 붙인다.
- **권한 없음은 404**: 볼 권한이 없는 일지·여행·회원(비공개, 차단 관계, 탈퇴)은 403이 아니라 404로 응답한다(NFR-03, FR-21).
- **목록**: `?page=0&size=20`으로 요청하고, 응답은 `{ "items": [...], "page": 0, "size": 20, "hasNext": true }` 모양이다.
- **사진 주소**: 응답의 사진 URL은 10분이 지나면 열리지 않는 서명 URL이다. 화면은 만료되면 다시 조회한다.
- **비동기 작업**: 오래 걸리는 작업은 202 Accepted로 시작을 알리고, 화면이 상태 조회 API를 2초마다 부른다.

## 에러 응답

모든 에러는 같은 모양으로 응답한다. `code`는 화면이 분기할 때 쓰고, `message`는 사용자에게 그대로 보여 줘도 되는 문장이다.

```json
{
  "code": "NICKNAME_TAKEN",
  "message": "이미 쓰는 닉네임이에요",
  "fields": [{ "field": "nickname", "reason": "TAKEN" }]
}
```

| HTTP | code | 언제 |
| --- | --- | --- |
| 400 | VALIDATION\_FAILED | 형식·길이 규칙 위반. 상세는 fields에 |
| 401 | UNAUTHENTICATED | 로그인하지 않았거나 세션이 만료됨 |
| 401 | INVALID\_CREDENTIALS | 이메일과 비밀번호가 맞지 않음. 어느 쪽이 틀렸는지는 알려 주지 않는다 |
| 404 | NOT\_FOUND | 없거나 볼 권한이 없음 |
| 409 | EMAIL\_TAKEN | 이미 가입된 이메일(탈퇴 유예 중 포함) |
| 409 | NICKNAME\_TAKEN | 활성 회원이 쓰고 있는 닉네임 |
| 409 | RELATION\_EXISTS | 이미 친구이거나 요청이 있음 |
| 413 | FILE\_TOO\_LARGE | 10MB를 넘는 사진 (NFR-02) |
| 415 | UNSUPPORTED\_MEDIA\_TYPE | JPG, PNG, WebP, HEIC가 아닌 파일 (NFR-02) |
| 422 | OCEAN\_NOT\_ALLOWED | 국가가 없는 좌표 (FR-06) |
| 422 | PHOTO\_LIMIT\_EXCEEDED | 일지 사진 5장 또는 가져오기 100장 초과 |
| 503 | GEOCODING\_UNAVAILABLE | 장소 검색 중 지오코딩 API 장애 (NFR-10) |

## 인증과 회원

| 메서드 | 경로 | 설명 | 요구사항 |
| --- | --- | --- | --- |
| POST | /auth/signup | 가입. 본문 email, password, nickname. 201 | FR-01, 18 |
| POST | /auth/login | 로그인. 본문 email, password. 세션 쿠키를 준다. 200 | FR-01 |
| POST | /auth/logout | 로그아웃. 세션을 폐기한다. 204 | FR-01 |
| GET | /auth/email-availability?email= | 이메일 사용 가능 여부 `{ "available": true }` | FR-01 |
| GET | /auth/nickname-availability?nickname= | 닉네임 사용 가능 여부. 입력하는 동안 호출 | FR-18 |
| GET | /me | 내 정보(닉네임, 이메일) | FR-02 |
| PATCH | /me | 닉네임 수정 | FR-02, 18 |
| POST | /me/withdrawal | 탈퇴. 본문 password. 성공하면 세션을 폐기한다. 204 | FR-19 |

닉네임 중복 확인은 가입 전에도 써야 해서 로그인 없이 부를 수 있는 `/auth` 아래에 뒀다.

## 지구본과 회원 조회

| 메서드 | 경로 | 설명 | 요구사항 |
| --- | --- | --- | --- |
| GET | /users/{userId}/globe | 지구본 화면 데이터: 주인 정보와 나와의 관계, 볼 수 있는 일지의 핀, 방문 국가 코드. 내 지구본은 userId 자리에 `me` | FR-04, 05, 12, 16 |
| GET | /users?nickname=&page= | 닉네임 검색(2자 이상, 한 번에 20명). 결과마다 나와의 관계를 담는다 | FR-17 |
| GET | /users/{userId}/trips | 그 회원의 여행 목록. 볼 수 있는 일지가 있는 여행만 | FR-09, 16 |

관계(relation) 값은 SELF, FRIEND, REQUEST\_SENT, REQUEST\_RECEIVED, NONE 중 하나다. 차단 관계면 회원 자체가 404다.

지구본 회전·확대(FR-03), 핀 클러스터링(FR-22), 빈 상태 화면(FR-23)은 화면에서 처리해서 따로 API가 없다. 핀은 페이지를 나누지 않고 한 번에 모두 내려준다.

## 일지와 위치

| 메서드 | 경로 | 설명 | 요구사항 |
| --- | --- | --- | --- |
| GET | /geocode/reverse?lat=&lng= | 지구본에서 누른 좌표의 국가·행정구역·장소명. 바다면 422 OCEAN\_NOT\_ALLOWED | FR-06 |
| GET | /geocode/search?q= | 장소 이름 검색. 국가가 없는 결과는 뺀다 | FR-06 |
| POST | /journals | 직접 기록. 본문 latitude, longitude, title, visitedOn, memo, photoIds, tripId, visibility. 201 | FR-06, 07, 10 |
| GET | /journals/{id} | 일지 상세. 작성자, 나와의 관계, 수정 가능 여부(editable)를 담는다 | FR-08, 12 |
| PATCH | /journals/{id} | 일지 수정. 보낸 필드만 바뀐다 | FR-08, 10 |
| DELETE | /journals/{id} | 일지 삭제. 204 | FR-08 |

- POST와 PATCH에서 국가·행정구역 값은 받지 않는다. 서버가 좌표로 역지오코딩을 다시 해서 채운다. 위치가 바뀌는 PATCH도 마찬가지다.
- 화면이 미리 부른 `/geocode/reverse` 결과는 표시용이다. 저장할 때는 서버가 다시 확인하므로, 바다 좌표를 직접 보내도 422로 막힌다.

## 사진

직접 기록에서 쓰는 사진 업로드다. 사진으로 기록하기는 다음 절의 전용 API를 쓴다.

| 메서드 | 경로 | 설명 | 요구사항 |
| --- | --- | --- | --- |
| POST | /photos | 사진 1장 업로드(multipart, 필드 이름 file). 크기를 줄이고 EXIF를 지운 뒤 임시 사진으로 저장한다. id와 썸네일 URL을 돌려준다. 201 | FR-07, NFR-02, 08 |
| DELETE | /photos/{id} | 아직 일지에 붙지 않은 임시 사진 삭제. 204 | NFR-08 |

사진은 POST·PATCH /journals의 photoIds로 일지에 붙인다. 남의 사진이나 이미 다른 일지에 붙은 사진의 id를 보내면 404다.

## 사진으로 기록하기

호출 순서는 다음과 같다.

1. 작업을 만든다.
2. 사진을 한 장씩 올린다. 실패한 사진만 다시 보낸다.
3. 다 올리면 묶기를 시작한다.
4. 상태를 2초마다 조회하다가 READY가 되면 초안을 불러온다.
5. 초안을 고치고, 위치를 정해야 하는 사진으로 초안을 더 만든다.
6. 저장한다.

| 메서드 | 경로 | 설명 | 요구사항 |
| --- | --- | --- | --- |
| POST | /imports | 작업 만들기. 본문 totalPhotos(1\~100). importId와 expiresAt을 돌려준다. 201 | FR-25 |
| GET | /imports/current | 진행 중인 내 작업. 없으면 404. 앱을 다시 열었을 때 이어 보기에 쓴다 | FR-25 |
| POST | /imports/{id}/photos | 사진 1장 업로드(multipart). 촬영 위치·시각을 읽고 EXIF를 지운 뒤 저장한다. 201 | FR-25, NFR-02, 11 |
| POST | /imports/{id}/grouping | 업로드를 끝내고 묶기를 시작한다. 202 | FR-25, NFR-11 |
| GET | /imports/{id} | 상태(UPLOADING, GROUPING, READY, FAILED)와 진행률 | FR-25, NFR-11 |
| GET | /imports/{id}/drafts | 초안 목록과 위치를 정해야 하는 사진 목록. READY일 때만 | FR-25 |
| PATCH | /imports/{id}/drafts/{draftId} | 초안 수정: title, memo, included, 고른 사진 photoIds(최대 5장) | FR-25 |
| POST | /imports/{id}/drafts | 위치를 정해야 하는 사진으로 초안 만들기. 본문 photoIds, latitude, longitude. 바다면 422. 201 | FR-25, 06 |
| DELETE | /imports/{id}/photos/{photoId} | 사진 빼기. 204 | FR-25 |
| POST | /imports/{id}/save | included가 참인 초안을 일지로 저장한다. 본문 newTrip(`{ "title": ... }` 또는 null). 만든 journalIds와 tripId를 돌려주고 작업은 지운다. 201 | FR-25, 09 |
| DELETE | /imports/{id} | 작업 취소. 사진과 초안을 정리한다. 204 | NFR-08 |

## 여행과 타임랩스

| 메서드 | 경로 | 설명 | 요구사항 |
| --- | --- | --- | --- |
| GET | /trips | 내 여행 목록 | FR-09 |
| POST | /trips | 여행 만들기. 본문 title, startDate, endDate, description. 201 | FR-09 |
| GET | /trips/{id} | 여행 상세와 날짜순 일지. 볼 수 있는 일지만 담는다 | FR-09 |
| PATCH | /trips/{id} | 여행 수정 | FR-09 |
| DELETE | /trips/{id} | 여행 삭제. 일지는 남고 연결만 풀린다. 204 | FR-09 |
| PUT | /trips/{id}/journals/{journalId} | 일지를 여행에 묶기. 이미 묶여 있어도 같은 결과다. 204 | FR-09 |
| DELETE | /trips/{id}/journals/{journalId} | 일지를 여행에서 빼기. 204 | FR-09 |
| GET | /trips/{id}/timelapse | 타임랩스 순서로 정렬한 장소 목록: 좌표, 제목, 날짜, 대표 사진 URL | FR-13, 26 |
| GET | /users/{userId}/timelapse?year= | 연도 타임랩스. 다른 회원이면 볼 수 있는 일지만 | FR-26 |

## 친구와 차단

| 메서드 | 경로 | 설명 | 요구사항 |
| --- | --- | --- | --- |
| POST | /friend-requests | 친구 요청. 본문 userId. 상대가 이미 나에게 요청했으면 바로 친구가 되고 200, 아니면 201 | FR-11 |
| GET | /friend-requests?direction=received | 받은 요청 목록 (sent면 보낸 요청 목록) | FR-20 |
| POST | /friend-requests/{id}/accept | 받은 요청 수락. 204 | FR-11 |
| POST | /friend-requests/{id}/reject | 받은 요청 거절. 기록을 지운다. 204 | FR-11 |
| DELETE | /friend-requests/{id} | 보낸 요청 취소. 204 | FR-11 |
| GET | /friends | 친구 목록 | FR-20 |
| DELETE | /friends/{userId} | 친구 삭제. 204 | FR-11 |
| POST | /blocks | 차단. 본문 userId. 기존 친구 관계나 요청은 차단으로 바뀐다. 204 | FR-21 |
| GET | /blocks | 내 차단 목록 | FR-21 |
| DELETE | /blocks/{userId} | 차단 해제. 친구 관계는 돌아오지 않는다. 204 | FR-21 |

차단당한 쪽이 차단한 회원에게 요청을 보내면 "없는 회원"과 같은 404를 돌려준다. 차단 사실을 알리지 않기 위해서다.

## 요청·응답 예시

**일지 직접 기록**: `POST /api/v1/journals`

```json
{
  "latitude": 35.011636,
  "longitude": 135.768029,
  "title": "철학의 길 산책",
  "visitedOn": "2025-04-12",
  "memo": "벚꽃이 거의 져서 사람이 적었다.",
  "photoIds": [101, 102],
  "tripId": 7,
  "visibility": "FRIENDS"
}
```

응답 201:

```json
{
  "id": 230,
  "title": "철학의 길 산책",
  "visitedOn": "2025-04-12",
  "location": {
    "latitude": 35.011636,
    "longitude": 135.768029,
    "countryCode": "JPN",
    "adminArea1": "교토부",
    "adminArea2": "교토시",
    "placeName": "철학의 길"
  },
  "visibility": "FRIENDS",
  "tripId": 7,
  "photos": [{ "id": 101, "url": "https://…", "thumbnailUrl": "https://…" }],
  "editable": true
}
```

**지구본 화면**: `GET /api/v1/users/me/globe`

```json
{
  "owner": { "id": 1, "nickname": "깡통여행", "relation": "SELF" },
  "pins": [
    {
      "journalId": 230,
      "latitude": 35.011636,
      "longitude": 135.768029,
      "title": "철학의 길 산책",
      "visitedOn": "2025-04-12",
      "thumbnailUrl": "https://…"
    }
  ],
  "visitedCountries": ["JPN", "KOR"]
}
```

**가져오기 작업 상태**: `GET /api/v1/imports/55`

```json
{
  "id": 55,
  "status": "GROUPING",
  "totalPhotos": 100,
  "uploadedPhotos": 100,
  "expiresAt": "2026-10-02T03:00:00Z"
}
```

## 설계 결정

| 항목 | 결정 | 근거 |
| --- | --- | --- |
| 인증 방식 | 서버 세션 + HttpOnly 쿠키 (Spring Security, 세션 저장은 Spring Session JDBC) | 같은 도메인의 웹 앱이라 토큰을 관리하는 화면 코드가 필요 없고, 로그아웃·탈퇴 즉시 세션을 끊을 수 있다(FR-19). JWT는 이미 발급한 토큰을 즉시 무효화하기 어렵다. 네이티브 앱을 만들 때 다시 검토한다. 세션 테이블은 Spring Session이 만든다 |
| CSRF 방어 | SameSite=Lax 쿠키 + CSRF 토큰 헤더 | 쿠키로 인증하면 다른 사이트가 사용자 몰래 요청을 보낼 수 있어서 막아야 한다 |
| 권한 없음 응답 | 404 | 403은 비공개 일지나 나를 차단한 회원이 "존재한다"는 정보를 흘린다 |
| 상태 전환 API | /accept, /reject, /grouping, /save 같은 동작 경로 | 수락이나 저장은 필드 하나를 고치는 게 아니라 여러 테이블이 함께 바뀌는 업무 동작이라 PATCH로 표현하기 어색하다 |
| 탈퇴 API | DELETE /me 대신 POST /me/withdrawal | 비밀번호를 본문으로 받아야 하고, 실제 동작은 삭제가 아니라 소프트 삭제(상태 변경)다 |
| 사진 업로드 경로 | 서버를 거쳐 업로드 | 서버가 크기 조정과 EXIF 제거를 해야 한다. 업로드량이 커지면 저장소에 직접 올린 뒤 서버가 처리하는 방식으로 바꾼다 |
| 가져오기 업로드 단위 | 사진 한 장씩 | 100장을 한 요청에 담으면 최대 1GB가 되고, 하나만 실패해도 전부 다시 보내야 한다 |
| 일지 묶기 API | PUT / DELETE /trips/{id}/journals/{journalId} | 같은 요청을 두 번 보내도 결과가 같아서(멱등) 네트워크 재시도에 안전하다 |
| 핀 페이지 나누기 | 하지 않음 | 개인 기록이라 일지 수가 많지 않다. 1,000개 수준에서 응답 크기를 다시 본다 |
| 문서 관리 | 이 문서로 개발을 시작하고, 이후에는 코드에서 Swagger(springdoc-openapi)로 자동 생성한 문서를 기준으로 삼는다 | 구현과 문서가 어긋나지 않도록 코드가 최종 문서가 되게 한다 |
