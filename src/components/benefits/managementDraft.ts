import type { BenefitGroupInput } from '../../domain/benefits/types';
/** In-memory round trip only; never persisted as a business record. */
export const managementDraft: {
    current?: {
        owner: string;
        route: string;
        draft: BenefitGroupInput;
        revision: number;
        initial: string;
        previewKey: string;
        notice: string;
        diagnosticId: string;
    };
} = {};
