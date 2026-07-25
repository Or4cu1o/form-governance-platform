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

  test('findActiveByIdentifier matches by matricula, email or ldapUsername, scoped to active users only', async () => {
    await service.findActiveByIdentifier('jsilva');

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { isActive: true, OR: [{ matricula: 'jsilva' }, { email: 'jsilva' }, { ldapUsername: 'jsilva' }] },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    });
  });

  test('findActiveById matches by id, scoped to active users only', async () => {
    await service.findActiveById('user-1');

    expect(findFirstMock).toHaveBeenCalledWith({
      where: { id: 'user-1', isActive: true },
      include: { primaryUnit: { select: { id: true, sigla: true, nome: true } } },
    });
  });
});
