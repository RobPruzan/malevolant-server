import { eq } from "drizzle-orm";

import { emojis, reactionAsset, token, user } from "./schema";
import { db, drizzleSql } from "./db";
import { getHash } from "@fireside/backend/src/user-endpoints";

(async () => {
  const corbinExists = await db
    .select()
    .from(user)
    .where(eq(user.username, "Corbin"))
    .then((data) => data.at(0));

  if (corbinExists) {
    return;
  }
  const tokenRes = await db
    .insert(token)
    .values({
      value: await getHash({ str: crypto.randomUUID() }),
    })
    .returning()
    .then((data) => data[0]);
  await db.insert(user).values({
    password: await getHash({ str: crypto.randomUUID() }),
    username: "Corbin",
    displayName: "Corbin Borgle",
    token: tokenRes.value,
    id: "ai-corbin",
  });

  drizzleSql.end();
})();
