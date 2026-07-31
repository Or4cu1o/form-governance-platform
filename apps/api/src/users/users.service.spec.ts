import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let findFirstMock: jest.Mock;

  beforeEach(() => {
    findFirstMock = jest.fn();
    const prisma = { user: { findFirst: findFirstMock } } as unknown as PrismaService;
    service = new UsersService(prisma);
  });

  const primaryUnitInclude = { primaryUnit: { select: { id: true, sigla: true, nome: true } } };

  test('findActiveByIdentifier matches by matricula or email, scoped to active users only', async () => {
    await service.findActiveByIdentifier('10001');

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { isActive: true, OR: [{ matricula: '10001' }, { email: '10001' }] },
      include: primaryUnitInclude,
    });
  });

  test('findActiveById matches by id, scoped to active users only', async () => {
    await service.findActiveById('user-1');

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: 'user-1', isActive: true },
      include: primaryUnitInclude,
    });
  });
});
