import { describe, expect, it, vi } from 'vitest';
import { WorkspaceService } from '../../apps/api/src/workspace/workspace.service';

function createHarness(conversation: { id: string } | null = { id: 'conversation-1' }) {
  const prisma = {
    conversation: {
      findFirst: vi.fn().mockResolvedValue(conversation),
      updateMany: vi.fn().mockResolvedValue({ count: conversation ? 1 : 0 }),
    },
    message: {
      create: vi.fn().mockResolvedValue({ id: 'message-1' }),
    },
  };
  const service = new WorkspaceService(prisma as any);
  return { service, prisma };
}

describe('WorkspaceService tenant isolation', () => {
  it('assigns conversations only after verifying tenant ownership', async () => {
    const { service, prisma } = createHarness();

    await service.assignConversation('conversation-1', 'tenant-1', 'admin-1');

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', tenantId: 'tenant-1' },
      select: { id: true, channel: true },
    });
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conversation-1', tenantId: 'tenant-1' },
      data: { assignedTo: 'admin-1' },
    });
  });

  it('does not update status when the conversation belongs to another tenant', async () => {
    const { service, prisma } = createHarness(null);

    await expect(service.updateStatus('conversation-1', 'tenant-2', 'closed')).rejects.toThrow('Conversation not found');

    expect(prisma.conversation.updateMany).not.toHaveBeenCalled();
  });

  it('unassigns conversations only after verifying tenant ownership', async () => {
    const { service, prisma } = createHarness();

    await service.unassignConversation('conversation-1', 'tenant-1');

    expect(prisma.conversation.findFirst).toHaveBeenCalledWith({
      where: { id: 'conversation-1', tenantId: 'tenant-1' },
      select: { id: true, channel: true },
    });
    expect(prisma.conversation.updateMany).toHaveBeenCalledWith({
      where: { id: 'conversation-1', tenantId: 'tenant-1' },
      data: { assignedTo: null },
    });
  });
});
