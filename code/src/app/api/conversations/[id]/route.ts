import { getConversation, deleteConversation } from '@/lib/conversations';
import { errorResponse, isPrismaNotFound } from '@/lib/api-utils';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const conversation = await getConversation(id);
    if (!conversation) {
      return errorResponse('VALIDATION_ERROR', 'Conversation not found', 404);
    }
    return Response.json({ conversation });
  } catch (error) {
    console.error('[API Handler] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return errorResponse('INTERNAL', message);
  }
}

export async function DELETE(req: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    await deleteConversation(id);
    return Response.json({ success: true });
  } catch (error) {
    if (isPrismaNotFound(error)) {
      return errorResponse('VALIDATION_ERROR', 'Conversation not found', 404);
    }
    console.error('[API Handler] Unhandled error:', error);
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return errorResponse('INTERNAL', message);
  }
}
