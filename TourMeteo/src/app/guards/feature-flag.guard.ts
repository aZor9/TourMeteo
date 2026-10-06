import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { FeatureFlagService, FeatureFlags } from '../service/feature-flag.service';

/** Redirige vers l'accueil si le feature flag est désactivé (lien direct / favori) */
export const featureFlagGuard = (flag: keyof FeatureFlags): CanActivateFn => () => {
  const ff = inject(FeatureFlagService);
  return ff.isEnabled(flag) ? true : inject(Router).createUrlTree(['/']);
};
