
import {  z } from "zod";

const urlOrEmpty = z
    .string()
    .trim()
    .refine(
        (value) => value === "" || /^(https?:\/\/\/uploads\/)/.test(value),
        "Use an http(s) URL or an uploaded file."
);

export const questionSchema = z.object({
    prompt: z.string().trim().min(3, "Ask a real Question.").max(240),
    choices: z.array(z.string().trim().min(1).max(140)).min(2).max(6),
    answer: z.number().int().min(0),
});

export const articleSchema = z.object({
    id: z.string().optional(),
    title: z.string().trim().min(10, "Add a title").max(160),
    excerpt: z.string().trim().min(10, "Add a short dek").max(300),
    content: z.object({
        type: z.literal("doc"),
        content: z.array(z.unknown()).optional(),
    }),
    coverImage: z.string().trim(),
    category: z.string().trim().min(2).max(40),
    tags: z.array(z.string().trim().min(1).max(30)).max(8),
    status: z.enum(["DRAFT", "PUBLISHED", "SCHEDULED"]),
    scheduledAt: z.string().optional(),
    videUrl: urlOrEmpty,
    audioUrl: urlOrEmpty,
    keyPoints: z.array(z.string().trim().max(220, "Keep each key point under 220 characters")).max(5).optional(),
    quizTitle: z.string().trim().max(120).optional(),
    questions: z.array(questionSchema).max(12),
}).superRefine((value, ctv) => {
    if (value.status !== "DRAFT" && !value.coverImage) {
        ctv.addIssue({ code: "custom", message: "Add a cover image before publishing", path: [
            "coverImage" ]});
    }
    if (value.status === "SCHEDULED") {
        const time = value.scheduledAt ? new Date(value.scheduledAt) : null;
        if (!time || Number.isNaN(time.getTime())) {
            ctv.addIssue({ code: "custom", message: "Pick a publish time", path: ["scheduleAt"]
            });
        } 
    }
    value.questions.forEach((question, index) => {
        if (question.answer >= question.choices.length) {
            ctv.addIssue({
                code: "custom",
                message: "Mark the correct answer",
                path: ["questions", index, "answer"],
            });
        }
    });
});

export const settingsSchema = z.object({
    siteName: z.string().trim().min(2).max(40),
    tagline: z.string().trim().min(2).max(120),
    description: z.string().trim().min(10).max(300),
});

export const taxoneBySchema = z.object({
    name: z.string().trim().min(2).max(40),
    description: z.string().trim().max(180).optional(),
});


export type ArticleInput = z.infer<typeof articleSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
