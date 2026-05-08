import {
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { ZodBody } from '../common/decorators';
import { ProxyPolicyService } from '../admin/proxy-policy.service';
import {
  UpsertProxyPolicyDtoSchema,
  type UpsertProxyPolicyDto,
} from '../admin/dto/upsert-proxy-policy.dto';
import { WorkerRegistryService } from './worker-registry.service';

@Controller('admin/proxy')
@UseGuards(SessionAuthGuard)
export class AdminProxyController {
  constructor(
    private readonly proxyPolicyService: ProxyPolicyService,
    private readonly workerRegistryService: WorkerRegistryService,
  ) {}

  @Get()
  async getSettings() {
    const workers = await this.workerRegistryService.listWorkers();
    return this.proxyPolicyService.getSettingsSnapshot(workers);
  }

  @Put('global')
  upsertGlobal(
    @Req() request: { admin?: { email?: string } },
    @ZodBody(UpsertProxyPolicyDtoSchema) body: UpsertProxyPolicyDto,
  ) {
    return this.proxyPolicyService.upsertPolicy({
      ...body,
      scopeType: 'global',
      scopeKey: undefined,
      updatedBy: request.admin?.email ?? 'unknown-admin',
    });
  }

  @Delete('global')
  async deleteGlobal() {
    await this.proxyPolicyService.deletePolicy('global');
    return { deleted: true };
  }

  @Put('worker-services/:serviceName')
  upsertWorkerService(
    @Param('serviceName') serviceName: string,
    @Req() request: { admin?: { email?: string } },
    @ZodBody(UpsertProxyPolicyDtoSchema) body: UpsertProxyPolicyDto,
  ) {
    return this.proxyPolicyService.upsertPolicy({
      ...body,
      scopeType: 'workerService',
      scopeKey: serviceName,
      updatedBy: request.admin?.email ?? 'unknown-admin',
    });
  }

  @Delete('worker-services/:serviceName')
  async deleteWorkerService(@Param('serviceName') serviceName: string) {
    await this.proxyPolicyService.deletePolicy('workerService', serviceName);
    return { deleted: true };
  }
}
