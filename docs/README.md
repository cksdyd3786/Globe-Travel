# 설계 문서

지구본 여행일지의 설계 산출물이다. 구현은 이 문서들을 기준으로 하고, 요구사항 ID(FR-xx, NFR-xx)로 코드·테스트·PR을 추적한다.

| 문서 | 내용 | 기준 버전 |
| --- | --- | --- |
| [requirements.md](requirements.md) | 요구사항 명세서: 기능·비기능 요구사항, 공개 범위 규칙, 결정 이력 | 1.3 |
| [db-design.md](db-design.md) | DB 설계서: PostgreSQL 16, ERD, 테이블·인덱스, 핵심 쿼리 | 1.2 |
| [api-spec.md](api-spec.md) | API 명세서: REST 엔드포인트, 에러 코드, 요청·응답 예시 | 1.0 |

와이어프레임(화면 설계): https://claude.ai/artifact/VeyLuATyqBPjhPi98Wqx6X

문서를 고치면 같은 PR에서 관련 코드도 함께 고친다. API는 구현이 시작되면 springdoc-openapi가 만드는 Swagger 문서를 최종 기준으로 삼는다.
