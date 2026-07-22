/**
 * Quick check that MediaConvert mezzanine env + IAM can talk to AWS.
 * Uses the same STORAGE_* credentials as production uploads.
 *
 *   npx tsx scripts/verify-mediaconvert-setup.ts
 */
import { DescribeEndpointsCommand, MediaConvertClient } from "@aws-sdk/client-mediaconvert";
import { GetRoleCommand, IAMClient } from "@aws-sdk/client-iam";

function clean(v: string | undefined): string | null {
  const t = v?.trim();
  return t ? t : null;
}

async function main() {
  const roleArn = clean(process.env.MEDIACONVERT_ROLE_ARN);
  const region =
    clean(process.env.MEDIACONVERT_REGION) ||
    clean(process.env.STORAGE_REGION) ||
    clean(process.env.S3_REGION) ||
    "us-east-1";
  const accessKeyId = clean(process.env.STORAGE_ACCESS_KEY_ID) || clean(process.env.S3_ACCESS_KEY_ID);
  const secretAccessKey =
    clean(process.env.STORAGE_SECRET_ACCESS_KEY) || clean(process.env.S3_SECRET_ACCESS_KEY);
  const publicFlag = clean(process.env.NEXT_PUBLIC_STREAM_MEZZANINE_ENABLED);

  console.log("MEDIACONVERT_ROLE_ARN:", roleArn ? "set" : "MISSING");
  console.log("NEXT_PUBLIC_STREAM_MEZZANINE_ENABLED:", publicFlag ?? "MISSING (should be true)");
  console.log("Region:", region);
  console.log("Storage keys:", accessKeyId && secretAccessKey ? "set" : "MISSING");

  if (!roleArn || !accessKeyId || !secretAccessKey) {
    console.error("\nIncomplete config. Set role ARN + STORAGE_* keys, then retry.");
    process.exit(1);
  }

  const credentials = { accessKeyId, secretAccessKey };
  const roleName = roleArn.split("/").pop() || "StorytimeMediaConvertRole";

  try {
    const iam = new IAMClient({ region, credentials });
    const role = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    console.log("IAM role OK:", role.Role?.Arn);
  } catch (err) {
    console.warn(
      "Could not GetRole (uploader may lack iam:GetRole — OK if CloudFormation created the role):",
      err instanceof Error ? err.message : err,
    );
  }

  try {
    const endpoint = clean(process.env.MEDIACONVERT_ENDPOINT);
    const client = new MediaConvertClient({
      region,
      credentials,
      ...(endpoint ? { endpoint } : {}),
    });
    if (!endpoint) {
      const described = await client.send(new DescribeEndpointsCommand({ MaxResults: 1 }));
      const url = described.Endpoints?.[0]?.Url;
      console.log("MediaConvert endpoint OK:", url);
    } else {
      console.log("MediaConvert endpoint (env):", endpoint);
    }
  } catch (err) {
    console.error(
      "\nMediaConvert API failed. Attach mediaconvert:DescribeEndpoints/CreateJob/GetJob + iam:PassRole to the uploader user.",
      err instanceof Error ? err.message : err,
    );
    process.exit(1);
  }

  if (publicFlag !== "true") {
    console.warn(
      "\nWarning: NEXT_PUBLIC_STREAM_MEZZANINE_ENABLED is not true — the upload UI will still block high-bitrate masters.",
    );
  }

  console.log("\nMediaConvert setup looks ready for auto-compress → Stream.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
