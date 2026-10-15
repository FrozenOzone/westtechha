(function(){
  'use strict';

  // Customer-facing logo variants used when an approved field/background
  // would hide part of a team's normal logo. Keep these rules explicit and
  // team-specific so the preview matches the intended printed treatment.
  const RULES = {
    NHL: {
      DAL: {
        fieldVariants: {
          'petg-olive-green': '../images/coasters/teams/nhl/context/DAL-on-olive-green.svg'
        }
      },
      CGY: {
        fieldVariants: {
          'petg-cherry-red': '../images/coasters/teams/nhl/context/CGY-on-cherry-red.svg'
        }
      },
      NSH: {
        fieldVariants: {
          'petg-yellow': '../images/coasters/teams/nhl/context/NSH-on-yellow.svg'
        }
      }
    }
  };

  function resolve(sport, teamId, fieldId, defaultUrl){
    return RULES?.[sport]?.[teamId]?.fieldVariants?.[fieldId] || defaultUrl || '';
  }

  window.WestTechTeamLogoContext = {rules:RULES, resolve};
})();
