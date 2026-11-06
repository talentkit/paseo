import { z } from "zod";

export const UserAvatarUrlSchema = z.union([z.literal(""), z.url({ protocol: /^https?$/ })]);

export const UserMessageAuthorSchema = z.object({
  username: z.string(),
  avatarUrl: z.string().optional(),
});

export type UserMessageAuthor = z.infer<typeof UserMessageAuthorSchema>;
