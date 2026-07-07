import { DocsLayout } from "../../components/docs/docs-layout";

const websiteUrl = import.meta.env.VITE_WEBSITE_URL;

export function meta() {
  const title = "开发者指南 - Dafthunk 文档";
  const description =
    "使用 Docker 在本地运行 Dafthunk 完整开发栈，了解项目结构、技术栈与贡献方式。";
  const url = `${websiteUrl}/docs/developers`;
  const ogImage = `${websiteUrl}/og-image.webp`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:url", content: url },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: ogImage },
    { property: "og:site_name", content: "Dafthunk" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:url", content: url },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: ogImage },
    { tagName: "link", rel: "canonical", href: url },
    { name: "robots", content: "index, follow" },
  ];
}

const breadcrumbJsonLd = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: websiteUrl },
    {
      "@type": "ListItem",
      position: 2,
      name: "Documentation",
      item: `${websiteUrl}/docs`,
    },
    {
      "@type": "ListItem",
      position: 3,
      name: "Developers Guide",
      item: `${websiteUrl}/docs/developers`,
    },
  ],
};

export default function DocsDevelopers() {
  return (
    <DocsLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <h1>开发者指南</h1>
      <p className="lead">
        欢迎阅读 Dafthunk 开发者指南。本文介绍如何在本地启动项目、理解架构，以及参与贡献。
        Dafthunk 是开源项目，欢迎提交 Issue 与 Pull Request。
      </p>

      <h2 id="changelog">更新说明</h2>
      <table>
        <thead>
          <tr>
            <th>日期</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>2026-07-07</td>
            <td>
              本地/自托管迁移至 Node 运行时：Postgres、本地对象存储、进程内工作流与队列、入站邮件
              webhook + SMTP 网关；新增实验性生产 Docker 编排。
            </td>
          </tr>
          <tr>
            <td>2026-07-06</td>
            <td>生产 Docker compose 与 <code>pnpm prod:up</code>。</td>
          </tr>
          <tr>
            <td>2026-07-05</td>
            <td>Docker 开发栈（3100/3101/3102）与 Node API 本地启动。</td>
          </tr>
        </tbody>
      </table>

      <h2 id="getting-started">本地开发</h2>
      <p>
        推荐使用 Docker 运行完整开发栈，无需在宿主机安装 Node.js 或 pnpm。详细说明见仓库根目录{" "}
        <code>README.md</code>。
      </p>

      <h3 id="ports">本地端口</h3>
      <table>
        <thead>
          <tr>
            <th>地址</th>
            <th>服务</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <code>http://localhost:3100</code>
            </td>
            <td>营销站（<code>@dafthunk/www</code>）</td>
          </tr>
          <tr>
            <td>
              <code>http://localhost:3101</code>
            </td>
            <td>产品应用（<code>@dafthunk/app</code>）</td>
          </tr>
          <tr>
            <td>
              <code>http://localhost:3102</code>
            </td>
            <td>API（<code>@dafthunk/api</code>，Node + Hono）</td>
          </tr>
        </tbody>
      </table>

      <h3 id="setup">初始化步骤</h3>
      <ol>
        <li>
          克隆仓库：
          <code>git clone https://github.com/dafthunk-com/dafthunk.git</code>
        </li>
        <li>
          复制配置：
          <code>cp .env.docker.example .env.docker</code>，{" "}
          <code>cp apps/api/.dev.vars.example apps/api/.dev.vars</code>
        </li>
        <li>
          生成密钥：
          <code>
            docker compose run --rm -e RUN_DB_MIGRATE=false dev node
            apps/api/scripts/generate-master-key.js
          </code>
          ，将输出的 <code>SECRET_MASTER_KEY</code> 与{" "}
          <code>JWT_SECRET</code> 写入 <code>apps/api/.dev.vars</code>
        </li>
        <li>
          启动：
          <code>docker compose --env-file .env.docker up --build</code>
        </li>
      </ol>
      <p>
        OAuth 回调地址使用 API 端口，例如 GitHub 登录：{" "}
        <code>http://localhost:3102/auth/login/github</code>。
      </p>

      <h2 id="how-to-contribute">如何贡献</h2>

      <h3>报告 Bug</h3>
      <p>
        在{" "}
        <a
          href="https://github.com/dafthunk-com/dafthunk/issues"
          target="_blank"
          rel="noopener noreferrer"
        >
          GitHub Issues
        </a>{" "}
        提交问题，请附上复现步骤、期望行为与实际行为。
      </p>

      <h3>提交 Pull Request</h3>
      <ol>
        <li>Fork 仓库</li>
        <li>创建功能分支</li>
        <li>编写改动并遵循项目代码规范</li>
        <li>提交清晰的 commit message</li>
        <li>发起 Pull Request</li>
      </ol>

      <h2 id="technology-stack">技术栈</h2>
      <table>
        <thead>
          <tr>
            <th>模块</th>
            <th>技术</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <strong>前端</strong>
            </td>
            <td>React 19、TypeScript、Tailwind CSS、shadcn/ui</td>
          </tr>
          <tr>
            <td>
              <strong>后端</strong>
            </td>
            <td>Hono、Node.js（本地）/ Cloudflare Workers（线上）、Postgres、本地 FS / R2</td>
          </tr>
          <tr>
            <td>
              <strong>工作流编辑器</strong>
            </td>
            <td>React Flow</td>
          </tr>
          <tr>
            <td>
              <strong>AI</strong>
            </td>
            <td>Cloudflare AI、Workers AI</td>
          </tr>
        </tbody>
      </table>
    </DocsLayout>
  );
}
