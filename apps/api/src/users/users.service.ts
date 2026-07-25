import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  findActiveByIdentifier(identifier: string) {
    return this.prisma.user.findFirst({
      where: {
        isActive: true,
        OR: [{ matricula: identifier }, { email: identifier }, { ldapUsername: identifier }],
      },
      include: {
        primaryUnit: {
          select: { id: true, sigla: true, nome: true },
        },
      },
    });
  }

  findActiveById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, isActive: true },
      include: {
        primaryUnit: {
          select: { id: true, sigla: true, nome: true },
        },
      },
    });
  }
}
