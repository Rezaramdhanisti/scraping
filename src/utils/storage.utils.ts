import {
  BucketAlreadyExists,
  BucketAlreadyOwnedByYou,
  CreateBucketCommand,
  GetObjectCommand,
  GetObjectCommandInput,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
  waitUntilBucketExists,
} from "@aws-sdk/client-s3";
import fs, { writeFileSync } from "fs";
import { s3 } from "../config/databases/index.js";
import { debugGenerator } from "../libs/mrscraper-cluster/util.js";
import { Upload } from "@aws-sdk/lib-storage";

// ================== File Helper ===================
export function uploadFile(
  file: string | NodeJS.ArrayBufferView,
  fullPath: string,
) {
  const outputDir = fullPath.split("/").slice(0, -1).join("/");
  console.log("outputDir", outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  try {
    fs.writeFileSync(fullPath, file);
    return fullPath;
  } catch (err) {
    console.error("upload error", err);
    return null;
  }
}

export class S3Storage {
  debug = debugGenerator("S3Storage");
  client: S3Client = new S3Client({
    region: s3.region,
    credentials: {
      accessKeyId: s3.accessKeyId!,
      secretAccessKey: s3.secretAccessKey!,
    },
  });
  bucket: string;
  constructor(bucket: string) {
    this.debug("Creating S3Storage", {
      region: s3.region,
      credentials: {
        accessKeyId: s3.accessKeyId!,
        secretAccessKey: s3.secretAccessKey!,
      },
    });
    this.bucket = bucket;
  }

  storagePath(
    filename: string,
    id: string | number,
    type: "result" | "upload" = "upload",
  ) {
    return type === "upload"
      ? "uploads/" + id + "/" + filename
      : "results/" + id + "/" + filename;
  }

  async createBucket() {
    try {
      const { Location } = await this.client.send(
        new CreateBucketCommand({
          // The name of the bucket. Bucket names are unique and have several other constraints.
          // See https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucketnamingrules.html
          Bucket: this.bucket,
        }),
      );
      await waitUntilBucketExists(
        { client: this.client, maxWaitTime: 100 },
        { Bucket: this.bucket },
      );
      console.log(`Bucket created with location ${Location}`);
    } catch (caught) {
      if (caught instanceof BucketAlreadyExists) {
        console.error(
          `The bucket "${this.bucket}" already exists in another AWS account. Bucket names must be globally unique.`,
        );
      }
      // WARNING: If you try to create a bucket in the North Virginia region,
      // and you already own a bucket in that region with the same name, this
      // error will not be thrown. Instead, the call will return successfully
      // and the ACL on that bucket will be reset.
      else if (caught instanceof BucketAlreadyOwnedByYou) {
        console.error(
          `The bucket "${this.bucket}" already exists in this AWS account.`,
        );
      } else {
        throw caught;
      }
    }
  }

  async getObject(key: string) {
    const params: GetObjectCommandInput = {
      Key: key,
      Bucket: this.bucket,
    };
    const command = new GetObjectCommand(params);
    try {
      const response = await this.client.send(command);
      const body = await response.Body?.transformToString();
      return body ? JSON.parse(body) : null;
    } catch (caught) {
      if (
        caught instanceof S3ServiceException &&
        caught.name === "EntityTooLarge"
      ) {
        console.error(
          `Error from S3 while uploading object to ${this.bucket}. \
The object was too large. To upload objects larger than 5GB, use the S3 console (160GB max) \
or the multipart upload API (5TB max).`,
        );
      } else if (caught instanceof S3ServiceException) {
        console.error(
          `Error from S3 while uploading object to ${this.bucket}.  ${caught.name}: ${caught.message}`,
        );
      } else {
        throw caught;
      }
    }
  }

  async upload(
    content: any,
    name: string,
    id: number | string,
    mime: string,
    type: "result" | "upload",
  ) {
    const params = {
      Bucket: this.bucket,
      Key: this.storagePath(name, id, type),
      ContentType: mime,
      Body: content,
    };
    const command = new PutObjectCommand(params);
    try {
      const response = await this.client.send(command);
      // console.log(response);
      return params.Key;
    } catch (caught) {
      if (
        caught instanceof S3ServiceException &&
        caught.name === "EntityTooLarge"
      ) {
        console.error(
          `Error from S3 while uploading object to ${this.bucket}. \
The object was too large. To upload objects larger than 5GB, use the S3 console (160GB max) \
or the multipart upload API (5TB max).`,
        );
      } else if (caught instanceof S3ServiceException) {
        console.error(
          `Error from S3 while uploading object to ${this.bucket}.  ${caught.name}: ${caught.message}`,
        );
      } else {
        throw caught;
      }
    }
    return null;
  }
}
