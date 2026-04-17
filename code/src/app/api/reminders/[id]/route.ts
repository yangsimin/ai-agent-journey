import { errorResponse, isPrismaNotFound } from '@/lib/api-utils';
import { updateReminder, deleteReminder } from '@/lib/reminders';
import { z } from 'zod';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchReminderSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  done: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return errorResponse('VALIDATION_ERROR', 'Invalid JSON body');
    }

    const result = patchReminderSchema.safeParse(body);
    if (!result.success) {
      return errorResponse('VALIDATION_ERROR', 'Validation failed', 400, result.error.flatten());
    }

    const reminder = await updateReminder(id, result.data);
    return Response.json({ reminder });
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return errorResponse('VALIDATION_ERROR', 'Reminder not found', 404);
    }
    console.error('[API Handler] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return errorResponse('INTERNAL', message);
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteReminder(id);
    return Response.json({ success: true });
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return errorResponse('VALIDATION_ERROR', 'Reminder not found', 404);
    }
    console.error('[API Handler] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return errorResponse('INTERNAL', message);
  }
}
