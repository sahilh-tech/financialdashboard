import { z } from "zod";

const observationSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  value: z.string()
});

export const fredSeriesResponseSchema = z.object({
  observations: z.array(observationSchema)
});

export type FredSeriesResponse = z.infer<typeof fredSeriesResponseSchema>;
