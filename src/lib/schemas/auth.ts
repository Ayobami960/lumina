import { z } from "zod";

export const credentialsSchema = z.object({
    email: z.string().trim().email("Enter a valid email").transform((value) => 
    value.toLowerCase()),
    password: z.string().min(8, "Use at least 8 characters"),
});


export const registerSchema = credentialsSchema.extend({
    name: z.string().trim().min(2, "Name is too short").max(80)
});

export const forgotSchema = credentialsSchema.pick({ email: true });

export const resetSchema = z.object({
    token: z.string().min(20, "This reset link is incomplete"),
    password: credentialsSchema.shape.password,
    confirm: z.string(),
})
.refine((value) => value.password === value.confirm, { path: ["confirm"], message:
"Passwords do not match"});



export const contactTopics = ["General", "Pitch a story", "Correction", "Partnership", "Account help"] as const;

export const contactSchema = z.object({
    name: z.string().trim().min(2, "Name is too short").max(80),
    email: credentialsSchema.shape.email,
    topic: z.enum(contactTopics),
    message: z.string().trim().min(20, "Tail us a little more").max(4000, "keep it under 4,000 characters"),
    website: z.string().max(0).optional(),
});


export const profileSchema = z.object({
    name: z.string().trim().min(2, "Name is too short").max(80),
    bio: z.string().trim().max(200, "Keep the bio under 200 character"),
    dateOfBirth: z.string().trim(),
    location: z.string().trim().max(80, "Location is too long"),
    website: z.string().trim().max(200),
    phone: z.string().trim().max(30, "Phone is too long"),
}).superRefine((value, ctx) => {
    if (value.dateOfBirth) {
        const date = new Date(`${value.dateOfBirth}T00:00:000Z`);
        if (Number.isNaN(date.getTime()) || date.getUTCFullYear() < 1900 || date.getTime() > 
        Date.now()) {
            ctx.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Enter a real date of birth"})
        }
    }
    if (value.website && !z.url().safeParse(value.website).success) {
        ctx.addIssue({ code: "custom", path: ["website"], message: "Use a full URL, like https://example.com"});
    }
});


export type CredentialsInput = z.infer<typeof credentialsSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotInput = z.infer<typeof forgotSchema>;
export type ResetInput = z.infer<typeof resetSchema>;
export type ContactInput = z.infer<typeof contactSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
