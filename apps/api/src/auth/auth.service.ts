import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../common/prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { email },
      include: { tenant: true },
    });

    if (!admin) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, admin.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      tenantId: admin.tenantId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        tenantId: admin.tenantId,
        tenant: {
          id: admin.tenant.id,
          name: admin.tenant.name,
          slug: admin.tenant.slug,
          type: admin.tenant.type,
        },
      },
    };
  }

  async register(
    tenantId: string,
    email: string,
    password: string,
    name?: string,
  ) {
    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await this.prisma.admin.create({
      data: {
        tenantId,
        email,
        password: hashedPassword,
        name,
      },
      include: { tenant: true },
    });

    const payload = {
      sub: admin.id,
      email: admin.email,
      role: admin.role,
      tenantId: admin.tenantId,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.name,
        role: admin.role,
        tenantId: admin.tenantId,
      },
    };
  }

  async validateUser(payload: any) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: payload.sub },
    });
    if (!admin) {
      throw new UnauthorizedException();
    }
    return admin;
  }
}
