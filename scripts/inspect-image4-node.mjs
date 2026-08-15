const org = "019ffe3c-b435-72af-bba9-4c01005a5841";
const wf = "019ffecc-95e2-716d-99f9-9ef1cdeb1ea5";
const nodeId = "ai-image-1786766253883";

const base = process.env.API_BASE ?? "http://localhost:3102";

async function main() {
  const wfRes = await fetch(
    `${base}/organizations/${org}/workflows/${wf}`,
    { headers: { cookie: process.env.SESSION_COOKIE ?? "" } }
  );
  const wfJson = await wfRes.json();
  const node = wfJson.nodes?.find((n) => n.id === nodeId);
  const history = node?.inputs?.find((i) => i.name === "images_history")?.value;
  const result = node?.inputs?.find((i) => i.name === "images_result")?.value;
  const selected =
    history?.items?.find((it) => it.id === history?.selectedId) ?? history?.items?.[0];

  console.log("=== NODE ===");
  console.log(JSON.stringify({ name: node?.name, metadata: node?.metadata }, null, 2));
  console.log("=== SELECTED HISTORY ===");
  console.log(JSON.stringify(selected, null, 2));
  console.log("=== RESULT ===");
  console.log(JSON.stringify(result, null, 2));

  const jobId = selected?.jobId;
  if (jobId) {
    const jobRes = await fetch(
      `${base}/organizations/${org}/platform-ai/generation-jobs/${jobId}`,
      { headers: { cookie: process.env.SESSION_COOKIE ?? "" } }
    );
    console.log("=== JOB ===");
    console.log(JSON.stringify(await jobRes.json(), null, 2));
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
