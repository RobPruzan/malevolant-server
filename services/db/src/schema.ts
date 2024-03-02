import { Type } from "@sinclair/typebox";
import { InferSelectModel } from "drizzle-orm";
import { serial, text, timestamp, pgTable, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-typebox";
import { DatesToString } from "@fireside/utils";
export const getOneYearAheadDate = () => {
  const currentDate = new Date();
  return new Date(
    currentDate.getFullYear() + 1,
    currentDate.getMonth(),
    currentDate.getDate()
  );
};
export const user = pgTable("user", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("name").notNull(),
  token: text("token").references(() => token.value),
  email: text("email").notNull(),
  password: text("password").notNull(),
  role: text("role").$type<"instructor" | "student">().notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .$defaultFn(() => new Date().toString())
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
});

export type User = InferSelectModel<typeof user>;

export const token = pgTable("token", {
  value: text("id").primaryKey(),
  expires: timestamp("expires", { mode: "string" }).$defaultFn(() =>
    getOneYearAheadDate().toString()
  ),
});

export const user_to_user = pgTable("friend", {
  id: uuid("id").defaultRandom().primaryKey(),
  userOneId: uuid("userOneId").references(() => user.id),
  userTwoId: uuid("userTwoId").references(() => user.id),
});

export const camp = pgTable("camp", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .$defaultFn(() => new Date().toString())
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
});

export type FiresideCamp = InferSelectModel<typeof camp>;

export const campSchema = createInsertSchema(camp);

export const campMembers = pgTable("campMembers", {
  id: uuid("id").defaultRandom().primaryKey(),
  campId: uuid("camp_id").references(() => camp.id),
  userId: uuid("user_id").references(() => user.id),
});

export const campMembersInsertSchema = createInsertSchema(campMembers, {
  userId: Type.Optional(Type.String()),
});

export const campMembersWithoutUserInsertSchema = createInsertSchema(
  campMembers,
  {
    userId: Type.Optional(Type.String()),
  }
);

export const bonfire = pgTable("bonfire", {
  id: uuid("id").defaultRandom().primaryKey(),
  campId: uuid("camp_id").references(() => camp.id),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { mode: "string" })
    .$defaultFn(() => new Date().toString())
    .notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
});

export const bonfireInsertSchema = createInsertSchema(bonfire);

export const userToBonfire = pgTable("userToBonfire", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("userId").references(() => user.id),
  bonfireId: uuid("bonfireId").references(() => bonfire.id),
  joinedAt: timestamp("created_at", { mode: "string" })
    .$defaultFn(() => new Date().toString())
    .notNull(),
});


export const chatDB = pgTable("chatMessages", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("name").notNull(),
  roomName: text("room").notNull(),
  chatMessage: text("msg").notNull()
});