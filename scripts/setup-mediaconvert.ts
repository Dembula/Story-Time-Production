/**
 * Create / verify MediaConvert IAM role + print Vercel env values.
 *
 * Usage (PowerShell), with the same keys Vercel uses for storage:
 *
 *   $env:STORAGE_BUCKET_NAME="your-bucket"
 *   $env:STORAGE_REGION="af-south-1"
 *   $env:STORAGE_ACCESS_KEY_ID="AKIA..."
 *   $env:STORAGE_SECRET_ACCESS_KEY="..."
 *   npx tsx scripts/setup-mediaconvert.ts
 *
 * Optional:
 *   $env:MEDIACONVERT_SETUP_APP_USER="storytime-uploader"
 *   $env:MEDIACONVERT_ROLE_NAME="StorytimeMediaConvertRole"
 *
 * Requires IAM permissions: iam:CreateRole, PutRolePolicy, CreatePolicy,
 * AttachUserPolicy, GetRole, PassRole (or run CloudFormation as admin instead).
 */
import {
  AttachUserPolicyCommand,
  CreatePolicyCommand,
  CreateRoleCommand,
  GetRoleCommand,
  IAMClient,
  PutRolePolicyCommand,
} from "@aws-sdk/client-iam";
import {
  CloudFormationClient,
  CreateStackCommand,
  DescribeStacksCommand,
} from "@aws-sdk/client-cloudformation";
import { DescribeEndpointsCommand, MediaConvertClient } from "@aws-sdk/client-mediaconvert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function clean(value: string | undefined): string | null {
  const v = value?.trim();
  return v ? v : null;
}

function requireEnv(name: string): string {
  const v = clean(process.env[name]);
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

async function main() {
  const bucket = requireEnv("STORAGE_BUCKET_NAME");
  const region =
    clean(process.env.MEDIACONVERT_REGION) ||
    clean(process.env.STORAGE_REGION) ||
    clean(process.env.S3_REGION) ||
    "us-east-1";
  const accessKeyId = requireEnv("STORAGE_ACCESS_KEY_ID");
  const secretAccessKey = requireEnv("STORAGE_SECRET_ACCESS_KEY");
  const roleName = clean(process.env.MEDIACONVERT_ROLE_NAME) || "StorytimeMediaConvertRole";
  const appUser = clean(process.env.MEDIACONVERT_SETUP_APP_USER);
  const useCloudFormation = process.env.MEDIACONVERT_SETUP_MODE !== "iam";

  const credentials = { accessKeyId, secretAccessKey };

  if (useCloudFormation) {
    const cfn = new CloudFormationClient({ region, credentials });
    const templateBody = readFileSync(
      resolve(process.cwd(), "deploy/connection-pack/mediaconvert-cloudformation.json"),
      "utf8",
    );
    const stackName = clean(process.env.MEDIACONVERT_STACK_NAME) || "storytime-mediaconvert";

    let existingArn: string | null = null;
    try {
      const described = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
      const outputs = described.Stacks?.[0]?.Outputs ?? [];
      existingArn =
        outputs.find((o) => o.OutputKey === "MediaConvertRoleArn")?.OutputValue ?? null;
      if (existingArn) {
        console.log(`Stack ${stackName} already exists.`);
        console.log(`MEDIACONVERT_ROLE_ARN=${existingArn}`);
      }
    } catch {
      // create below
    }

    if (!existingArn) {
      console.log(`Creating CloudFormation stack ${stackName}…`);
      await cfn.send(
        new CreateStackCommand({
          StackName: stackName,
          TemplateBody: templateBody,
          Capabilities: ["CAPABILITY_NAMED_IAM"],
          Parameters: [
            { ParameterKey: "BucketName", ParameterValue: bucket },
            { ParameterKey: "RoleName", ParameterValue: roleName },
            ...(appUser
              ? [{ ParameterKey: "AppUserName", ParameterValue: appUser }]
              : [{ ParameterKey: "AppUserName", ParameterValue: "" }]),
          ],
        }),
      );

      for (let i = 0; i < 60; i += 1) {
        await new Promise((r) => setTimeout(r, 5000));
        const described = await cfn.send(new DescribeStacksCommand({ StackName: stackName }));
        const stack = described.Stacks?.[0];
        const status = stack?.StackStatus ?? "";
        process.stdout.write(`  status: ${status}\n`);
        if (status.endsWith("_COMPLETE") || status.endsWith("_FAILED")) {
          if (!status.includes("CREATE_COMPLETE") && !status.includes("UPDATE_COMPLETE")) {
            throw new Error(`Stack ended with status ${status}`);
          }
          existingArn =
            stack?.Outputs?.find((o) => o.OutputKey === "MediaConvertRoleArn")?.OutputValue ??
            null;
          break;
        }
      }
    }

    if (!existingArn) throw new Error("Could not resolve MediaConvert role ARN from stack.");

    await printEndpointAndEnv(region, credentials, existingArn);
    return;
  }

  // Fallback: create role via IAM APIs directly
  const iam = new IAMClient({ region, credentials });
  let roleArn: string;
  try {
    const got = await iam.send(new GetRoleCommand({ RoleName: roleName }));
    roleArn = got.Role?.Arn ?? "";
    console.log(`Role already exists: ${roleArn}`);
  } catch {
    const trust = readFileSync(
      resolve(process.cwd(), "deploy/connection-pack/iam-trust-mediaconvert.json"),
      "utf8",
    );
    const created = await iam.send(
      new CreateRoleCommand({
        RoleName: roleName,
        AssumeRolePolicyDocument: trust,
        Description: "Story Time MediaConvert mezzanine role",
      }),
    );
    roleArn = created.Role?.Arn ?? "";
    console.log(`Created role: ${roleArn}`);
  }

  const s3Policy = readFileSync(
    resolve(process.cwd(), "deploy/connection-pack/iam-policy-mediaconvert-s3.json"),
    "utf8",
  ).replaceAll("YOUR_BUCKET_NAME", bucket);

  await iam.send(
    new PutRolePolicyCommand({
      RoleName: roleName,
      PolicyName: "StorytimeMediaConvertS3Access",
      PolicyDocument: s3Policy,
    }),
  );
  console.log("Attached S3 access policy to MediaConvert role.");

  if (appUser) {
    const accountId = roleArn.split(":")[4];
    const apiPolicyDoc = readFileSync(
      resolve(process.cwd(), "deploy/connection-pack/iam-policy-storytime-mediaconvert-api.json"),
      "utf8",
    )
      .replaceAll("YOUR_BUCKET_NAME", bucket)
      .replaceAll("YOUR_ACCOUNT_ID", accountId)
      .replaceAll("StorytimeMediaConvertRole", roleName);

    const policyName = `StorytimeMediaConvertApi-${bucket}`.slice(0, 128);
    let policyArn: string;
    try {
      const created = await iam.send(
        new CreatePolicyCommand({
          PolicyName: policyName,
          PolicyDocument: apiPolicyDoc,
          Description: "Story Time MediaConvert API for app uploader",
        }),
      );
      policyArn = created.Policy?.Arn ?? "";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!/EntityAlreadyExists|already exists/i.test(message)) throw err;
      policyArn = `arn:aws:iam::${accountId}:policy/${policyName}`;
    }

    await iam.send(
      new AttachUserPolicyCommand({
        UserName: appUser,
        PolicyArn: policyArn,
      }),
    );
    console.log(`Attached API policy to IAM user ${appUser}`);
  }

  await printEndpointAndEnv(region, credentials, roleArn);
}

async function printEndpointAndEnv(
  region: string,
  credentials: { accessKeyId: string; secretAccessKey: string },
  roleArn: string,
) {
  let endpoint = "";
  try {
    const probe = new MediaConvertClient({ region, credentials });
    const described = await probe.send(new DescribeEndpointsCommand({ MaxResults: 1 }));
    endpoint = described.Endpoints?.[0]?.Url ?? "";
  } catch (err) {
    console.warn(
      "Could not DescribeEndpoints yet (attach mediaconvert:DescribeEndpoints to the app user, then retry).",
      err instanceof Error ? err.message : err,
    );
  }

  console.log("\n========== Add these to Vercel (Production) ==========\n");
  console.log(`MEDIACONVERT_ROLE_ARN=${roleArn}`);
  console.log(`MEDIACONVERT_REGION=${region}`);
  if (endpoint) console.log(`MEDIACONVERT_ENDPOINT=${endpoint}`);
  console.log("NEXT_PUBLIC_STREAM_MEZZANINE_ENABLED=true");
  console.log("\nThen redeploy. High-bitrate masters will auto-compress before Stream.\n");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
