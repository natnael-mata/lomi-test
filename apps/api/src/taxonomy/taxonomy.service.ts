import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { assertWeightsSumTo100 } from './weights';

@Injectable()
export class TaxonomyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Throws unless every topic in the field is weighted and the weights sum to
   * exactly 100.00%. Called before a field may be published — an unweighted or
   * mis-weighted field would make readiness and exam sampling silently wrong.
   */
  async assertFieldWeightsSumTo100(fieldId: string): Promise<void> {
    const topics = await this.prisma.topic.findMany({
      where: { course: { fieldId } },
      select: { name: true, weightPct: true },
    });

    assertWeightsSumTo100(
      // Prisma returns Decimal; toNumber() is safe at numeric(5,2), and the
      // assertion re-quantises to integer hundredths anyway.
      topics.map((t) => ({ name: t.name, weightPct: t.weightPct?.toNumber() ?? null })),
    );
  }
}
