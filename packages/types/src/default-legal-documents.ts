import type { LegalDocumentsConfig } from "./legal-documents";

const EFFECTIVE_DATE = "2025-06-09";
const CONTACT_EMAIL = "contact@dafthunk.com";

export const DEFAULT_LEGAL_DOCUMENTS: LegalDocumentsConfig = {
  terms: {
    en: {
      title: "Terms of Service",
      effectiveDate: EFFECTIVE_DATE,
      body: `These Terms of Service ("Terms") govern your access to and use of our visual workflow platform (the "Service"). By creating an account or using the Service, you agree to these Terms.

## 1. The Service

We provide tools to design, run, and monitor serverless workflows, including integrations with third-party APIs and AI models. Features may change as the product evolves. We may add, modify, or discontinue functionality with reasonable notice when practical.

## 2. Your account

You are responsible for safeguarding your credentials and for activity under your account. Provide accurate registration information and notify us promptly of unauthorized access.

## 3. Acceptable use

You agree not to:

- Violate applicable laws or third-party rights.
- Upload or process personal data without a lawful basis and necessary consents.
- Use the Service to distribute malware, spam, or abusive content.
- Attempt to bypass security, rate limits, or access controls.
- Reverse engineer or resell the Service except as permitted by us in writing.

We may suspend or terminate accounts that violate these Terms or pose risk to the Service or other users.

## 4. Your content and workflows

You retain ownership of workflows, data, and outputs you create, subject to third-party provider terms for connected services. You grant us the rights necessary to host, process, and transmit your content solely to operate the Service.

You are responsible for ensuring that data processed through your workflows complies with applicable law and that you have permission to use connected integrations.

## 5. AI and third-party services

The Service may invoke external AI providers and integrations you configure. Their availability, pricing, and policies are controlled by those providers. We do not guarantee model outputs and are not liable for third-party service failures.

## 6. Fees

Paid plans, if offered, are billed according to the pricing shown at purchase. Taxes may apply. Refunds are handled as stated on the billing page or required by law.

## 7. Disclaimers

The Service is provided **"as is"** without warranties of uninterrupted or error-free operation. To the maximum extent permitted by law, we disclaim implied warranties of merchantability, fitness for a particular purpose, and non-infringement.

## 8. Limitation of liability

To the maximum extent permitted by law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or for loss of profits, data, or goodwill. Our aggregate liability arising from the Service is limited to the greater of (a) amounts you paid us in the twelve months before the claim or (b) USD 100.

## 9. Changes

We may update these Terms. Material changes will be announced in the Service or by email. Continued use after the effective date constitutes acceptance.

## 10. Contact

Questions about these Terms: **${CONTACT_EMAIL}**`,
    },
    zh: {
      title: "服务条款",
      effectiveDate: EFFECTIVE_DATE,
      body: `本服务条款（「条款」）适用于您访问和使用我们的可视化工作流平台（「服务」）。注册账户或使用服务即表示您同意本条款。

## 1. 服务内容

我们提供设计、运行和监控无服务器工作流的工具，包括与第三方 API 和 AI 模型的集成。随着产品迭代，功能可能调整。在合理可行的情况下，我们会就重大变更提前通知。

## 2. 您的账户

您应妥善保管登录凭据，并对账户下的活动负责。请提供真实注册信息，并在发现未授权访问时及时通知我们。

## 3. 可接受使用

您不得：

- 违反法律法规或侵害第三方权利。
- 在无合法依据和必要同意的情况下上传或处理个人数据。
- 利用服务传播恶意软件、垃圾信息或滥用性内容。
- 试图绕过安全机制、速率限制或访问控制。
- 除我们书面同意外，对服务进行逆向工程或转售。

若违反本条款或对其他用户/服务构成风险，我们可暂停或终止账户。

## 4. 您的内容与工作流

您保留所创建工作流、数据及输出的所有权，但须遵守所连接第三方服务的服务条款。为运营服务所必需，您授予我们托管、处理和传输相关内容的有限权利。

您须确保通过工作流处理的数据符合适用法律，且您有权使用所配置的集成。

## 5. AI 与第三方服务

服务可能调用您配置的外部 AI 提供商与集成。其可用性、定价和政策由相应提供商决定。我们不保证模型输出结果，也不对第三方服务故障承担责任。

## 6. 费用

如提供付费方案，将按购买时展示的价格计费。可能适用税费。退款按账单页面说明或法律要求处理。

## 7. 免责声明

服务按 **「现状」** 提供，不保证不间断或无错误运行。在法律允许的最大范围内，我们否认适销性、特定用途适用性和不侵权等默示保证。

## 8. 责任限制

在法律允许的最大范围内，我们不对间接、附带、特殊、后果性或惩罚性损害，或利润、数据、商誉损失承担责任。因服务产生的总责任上限为您在索赔前 12 个月内向我们支付的金额与 100 美元中的较高者。

## 9. 条款变更

我们可能更新本条款。重大变更将通过服务内通知或邮件告知。生效日后继续使用即视为接受。

## 10. 联系我们

条款相关问题请联系：**${CONTACT_EMAIL}**`,
    },
  },
  privacy: {
    en: {
      title: "Privacy Policy",
      effectiveDate: EFFECTIVE_DATE,
      body: `This Privacy Policy explains how we collect, use, and protect personal information when you use our workflow platform.

## 1. Information we collect

- **Account data:** name, email, authentication identifiers (e.g. when signing in with email, Google, or GitHub).
- **Workflow data:** workflow definitions, execution inputs/outputs, logs, and metadata needed to run automations you configure.
- **Usage data:** product interactions, diagnostics, and security logs.
- **Billing data:** processed by our payment provider (e.g. Stripe); we do not store full payment card numbers.
- **Integration data:** when you connect third-party services, we process data required to execute the nodes you enable, according to your configuration.

## 2. How we use information

We use data to provide and improve the Service, authenticate users, run workflows, process subscriptions, respond to support requests, and protect against abuse.

We do not sell personal information or use it for third-party advertising.

## 3. Legal bases (where applicable)

Processing may rely on contract performance, legitimate interests (security and product improvement), legal obligations, or consent where required.

## 4. Sharing

We share data with infrastructure and subprocessors that help operate the Service (e.g. cloud hosting, email delivery, payment processing) under appropriate agreements. We may disclose information if required by law or to protect rights and safety.

## 5. International transfers

Data may be processed in countries other than your own. We apply safeguards appropriate to the transfer mechanism used.

## 6. Retention

We retain information while your account is active and as needed for legal, security, and billing purposes. You may request account deletion subject to applicable retention requirements.

## 7. Security

We implement technical and organizational measures designed to protect personal information. No online service is completely secure; please avoid storing highly sensitive data unless necessary.

## 8. Your rights

Depending on your location, you may have rights to access, correct, delete, restrict, or port your data, or to object to certain processing. Contact us to exercise these rights.

## 9. Children

The Service is not directed to children under 13 (or 16 in the EU). We do not knowingly collect data from children.

## 10. Changes

We may update this Policy and will notify you of material changes through the Service or email.

## 11. Contact

Privacy questions: **${CONTACT_EMAIL}**`,
    },
    zh: {
      title: "隐私政策",
      effectiveDate: EFFECTIVE_DATE,
      body: `本隐私政策说明我们在您使用工作流平台时如何收集、使用和保护个人信息。

## 1. 我们收集的信息

- **账户信息：** 姓名、邮箱、认证标识（如通过邮箱、Google 或 GitHub 登录）。
- **工作流数据：** 工作流定义、执行输入/输出、日志及运行您所配置自动化所需的元数据。
- **使用数据：** 产品交互、诊断与安全日志。
- **账单信息：** 由支付服务商（如 Stripe）处理；我们不存储完整银行卡号。
- **集成数据：** 当您连接第三方服务时，我们按您的节点配置处理执行所需的数据。

## 2. 信息用途

我们使用数据以提供和改进服务、验证身份、运行工作流、处理订阅、响应支持请求并防范滥用。

我们不会出售个人信息，也不会将其用于第三方广告。

## 3. 处理的法律依据（如适用）

处理可能基于合同履行、合法利益（安全与产品改进）、法定义务，或在需要时基于您的同意。

## 4. 信息共享

我们会与帮助运营服务的基础设施和子处理器（如云托管、邮件投递、支付处理）在适当协议下共享数据。在法律要求或为保护权利与安全时，我们可能披露信息。

## 5. 跨境传输

数据可能在您所在国以外处理。我们会根据所采用的传输机制采取适当保障措施。

## 6. 保留期限

在账户活跃期间及法律、安全、账单所需期限内保留信息。您可请求删除账户，但须遵守适用的保留要求。

## 7. 安全

我们采取技术与组织措施保护个人信息。任何在线服务都无法保证绝对安全；请勿在非必要时存储高度敏感数据。

## 8. 您的权利

根据所在地区，您可能享有访问、更正、删除、限制处理、数据可携带或反对特定处理的权利。请联系我们行使相关权利。

## 9. 儿童隐私

服务不面向 13 岁以下（欧盟为 16 岁以下）儿童。我们不会故意收集儿童数据。

## 10. 政策变更

我们可能更新本政策，并通过服务内通知或邮件告知重大变更。

## 11. 联系我们

隐私相关问题请联系：**${CONTACT_EMAIL}**`,
    },
  },
};
