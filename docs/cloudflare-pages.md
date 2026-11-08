# Публикация на Cloudflare Pages

После однократной настройки каждый push в `main` (включая merge pull request)
запускает `.github/workflows/ci.yml`: lint → проверка типов → unit-тесты → E2E →
сборка → проверка размера JavaScript → Lighthouse. Только после успешного завершения
всех проверок job `deploy` загружает готовый `dist/` в Cloudflare Pages.
При push в `main` после проверок выполняется production-сборка с опциональной
переменной `PUBLIC_GA_MEASUREMENT_ID` и проверкой размера JS. При загрузке в Cloudflare
повторной сборки нет. Pull request, другие ветки и теги проходят CI
без публикации и без использования токена Cloudflare.

Используется **Pages Direct Upload через Wrangler**, а сборка выполняется в GitHub
Actions на Node из `.nvmrc`. Astro уже настроен с `output: 'static'`; сервер,
Cloudflare adapter и Pages Functions не нужны.

## 1. Создать проект Pages

Нужны права администратора репозитория GitHub и доступ к аккаунту Cloudflare.
Из корня репозитория выполните локально:

```bash
npx wrangler@4 login
npx wrangler@4 pages project create
```

Выберите нужный аккаунт, задайте имя проекта (например, `uv-go`) и production branch
**`main`**. Сохраните фактическое имя и адрес проекта: Cloudflare может добавить
суффикс к адресу `*.pages.dev`, если желаемый адрес занят.

Создавайте именно проект **Pages**, не Worker. Не подключайте к нему автоматическую
Git-сборку Cloudflare: публикацией управляет GitHub Actions, иначе появится второй
независимый путь деплоя без ожидания проверок CI. Для существующего проекта с Git
integration сначала отключите автоматические production/preview deployments.
Direct Upload нельзя впоследствии переключить на Git integration без нового проекта.

## 2. Создать токен

В Cloudflare откройте **API Tokens → Create Token → Custom Token**:

- Имя: например, `GitHub Actions — UV GO Pages`.
- Permission: **Account → Cloudflare Pages → Edit**.
- Account Resources: **Include → Specific account → ваш аккаунт**.

Скопируйте токен сразу после создания. Account ID возьмите в панели Cloudflare
для того же аккаунта (это не Zone ID). Токен не записывайте в репозиторий.

## 3. Настроить GitHub Actions

В репозитории откройте **Settings → Secrets and variables → Actions**.

Во вкладке **Secrets** добавьте repository secrets:

| Имя | Значение |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Созданный API token |
| `CLOUDFLARE_ACCOUNT_ID` | Account ID аккаунта с проектом Pages |

Во вкладке **Variables** добавьте repository variable:

| Имя | Значение |
| --- | --- |
| `PUBLIC_GA_MEASUREMENT_ID` | Необязательно: GA4 Measurement ID вида `G-XXXXXXXXXX`; пустое значение отключает аналитику |
| `CLOUDFLARE_PAGES_PROJECT_NAME` | Точное имя проекта из шага 1, например `uv-go`; без URL и `.pages.dev` |

В **Settings → Actions → General** разрешите выполнение GitHub Actions и actions
`actions/*`, `cloudflare/wrangler-action`. Workflow использует только
`contents: read` для GitHub; запись в репозиторий ему не нужна.

## 4. Задать публичный URL

Основной production URL уже задан в `src/site.config.ts`:

```ts
site: 'https://uv-go.dekky.dev',
```

Этот адрес используется в canonical, Open Graph, JSON-LD, sitemap и `robots.txt`.
Перед публикацией подключите `uv-go.dekky.dev` в **Pages → ваш проект → Custom domains**
и дождитесь активации домена и HTTPS. Затем опубликуйте новую сборку.
Настройки окружения в панели Pages не меняют сайт: сборка выполняется в GitHub.

Если старый домен Vercel или адрес `*.pages.dev` доступны публично, настройте на стороне
хостинга постоянный редирект на `https://uv-go.dekky.dev` с сохранением пути и query string.
Не добавляйте безусловный редирект на тот же домен в общие правила сайта: это создаст цикл.
После публикации проверьте canonical и отправьте
`https://uv-go.dekky.dev/sitemap-index.xml` в Google Search Console и Bing Webmaster Tools.

## 5. Первый деплой и проверка

1. Отправьте изменения workflow и конфигурации сайта в `main`.
2. В GitHub откройте **Actions → CI** для этого коммита. Дождитесь успешных jobs
   `build` и `Deploy to Cloudflare Pages`.
3. В логе шага `Deploy static site` найдите URL публикации. В Cloudflare откройте
   **Workers & Pages → ваш проект → Deployments** и проверьте production deployment
   ветки `main` с нужным коммитом.
4. Откройте production URL, статью `/uv-index/`, `/robots.txt` и
   `/sitemap-index.xml`. Проверьте выбор города и получение прогноза.
5. Сделайте следующий commit в `main` и убедитесь, что production обновился.

Для повторной попытки используйте **Re-run failed jobs** у актуального запуска CI;
если artifact уже удалён (срок хранения — 7 дней), выберите **Re-run all jobs**.
Повторный запуск старого коммита может опубликовать старую версию — выбирайте
последний коммит `main`. При новых запусках CI предыдущий запуск той же ветки
отменяется; если его публикация уже успела завершиться, новая заменит её после проверок.

## Если публикация не прошла

- `Set ... repository secret/variable`: заполните настройки из шага 3.
- Ошибка авторизации: проверьте срок действия токена, право Pages Edit и Account ID.
- Проект не найден: проверьте имя проекта и выбранный аккаунт.
- Вместо production появился preview: production branch проекта должна быть `main`.
- `deploy` пропущен: это ожидаемо для PR, тегов и веток кроме `main`; также проверьте
  результат `build`. При провале проверок текущая production-версия остаётся доступной.
- Ошибка в `build`: исправьте упавшую проверку; деплой до её успеха не запускается.

Для отката откройте успешную предыдущую production-публикацию в Cloudflare Pages
и выберите **Rollback to this deployment**. Затем исправьте или отмените проблемный
коммит в `main`, иначе следующий успешный CI снова опубликует содержимое этой ветки.

## Документация

- [Cloudflare: Direct Upload с CI](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)
- [Cloudflare: создание Direct Upload проекта](https://developers.cloudflare.com/pages/get-started/direct-upload/)
- [Wrangler GitHub Action](https://github.com/cloudflare/wrangler-action)
- [Откат публикации](https://developers.cloudflare.com/pages/configuration/rollbacks/)
