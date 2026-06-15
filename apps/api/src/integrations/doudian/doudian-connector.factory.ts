import { Injectable } from '@nestjs/common';
import { DoudianConnector } from './doudian-connector.interface';

class MockDoudianConnector implements DoudianConnector {
  async getProducts() {
    return { items: [] };
  }
}

@Injectable()
export class DoudianConnectorFactory {
  private readonly mock = new MockDoudianConnector();

  getConnector(): DoudianConnector {
    return this.mock;
  }
}
