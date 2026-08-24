(function(){
  'use strict';
  // Approved WestTech NFL Single Team production color baseline.
  // Promoted from Color Lab export generated: 2026-08-16T13:35:52.419Z
  // Palette entries include the current physical production filament reference.
  window.WestTechNFLSingleTeamPrintPalette = [
  {
    "id": "white",
    "label": "White",
    "hex": "#f5f5f2",
    "filament": "SUNLU White",
    "filamentStatus": "on-hand"
  },
  {
    "id": "warm-white",
    "label": "Warm White",
    "hex": "#e9e2d4",
    "filament": "SUNLU Bone White",
    "filamentStatus": "on-hand"
  },
  {
    "id": "light-gray",
    "label": "Light Gray",
    "hex": "#c4c8cc",
    "filament": "SUNLU Silver",
    "filamentStatus": "on-hand"
  },
  {
    "id": "gray",
    "label": "Gray",
    "hex": "#8d949b",
    "filament": "SUNLU Grey",
    "filamentStatus": "on-hand"
  },
  {
    "id": "dark-gray",
    "label": "Dark Gray",
    "hex": "#4d5258",
    "filament": "SUNLU Grey",
    "filamentStatus": "on-hand",
    "filamentNote": "Closest stocked dark neutral"
  },
  {
    "id": "black",
    "label": "Black",
    "hex": "#111317",
    "filament": "SUNLU Black",
    "filamentStatus": "on-hand"
  },
  {
    "id": "red",
    "label": "Red",
    "hex": "#d9232e",
    "filament": "SUNLU Cherry Red",
    "filamentStatus": "on-hand",
    "filamentNote": "Lighter/brighter red"
  },
  {
    "id": "dark-red",
    "label": "Dark Red",
    "hex": "#8b1e2d",
    "filament": "SUNLU Red",
    "filamentStatus": "on-hand",
    "filamentNote": "Darker red"
  },
  {
    "id": "orange",
    "label": "Orange",
    "hex": "#f26a21",
    "filament": "SUNLU Sunny Orange",
    "filamentStatus": "on-hand"
  },
  {
    "id": "yellow",
    "label": "Yellow",
    "hex": "#f4c430",
    "filament": "SUNLU Yellow",
    "filamentStatus": "on-hand"
  },
  {
    "id": "lime",
    "label": "Lime",
    "hex": "#77c043",
    "filament": "Lime Green \u2014 not stocked",
    "filamentStatus": "missing",
    "filamentNote": "ELEGOO Apple Green candidate"
  },
  {
    "id": "green",
    "label": "Green",
    "hex": "#168b55",
    "filament": "SUNLU Green",
    "filamentStatus": "on-hand"
  },
  {
    "id": "dark-green",
    "label": "Dark Green",
    "hex": "#1e4c3b",
    "filament": "SUNLU Olive Green",
    "filamentStatus": "on-hand",
    "filamentNote": "Current dark/forest green"
  },
  {
    "id": "royal-blue",
    "label": "Royal Blue",
    "hex": "#2447b8",
    "filament": "SUNLU Blue (Klein Blue)",
    "filamentStatus": "on-hand",
    "filamentNote": "Current blue; physical print is darker than the name"
  },
  {
    "id": "navy",
    "label": "Navy",
    "hex": "#15294d",
    "filament": "SUNLU Blue (Klein Blue)",
    "filamentStatus": "on-hand",
    "filamentNote": "Same current physical blue used for darker blue roles"
  },
  {
    "id": "light-blue",
    "label": "Light Blue",
    "hex": "#67aee8",
    "filament": "SUNLU Sky Blue",
    "filamentStatus": "on-hand"
  },
  {
    "id": "cyan",
    "label": "Cyan",
    "hex": "#27b8cf",
    "filament": "ELEGOO PLA Basic Cyan",
    "filamentStatus": "ordered",
    "filamentNote": "Ordered; fit/print test pending"
  },
  {
    "id": "teal",
    "label": "Teal",
    "hex": "#168f94",
    "filament": "ELEGOO PLA Basic Cyan",
    "filamentStatus": "ordered",
    "filamentNote": "Planned cyan/teal production filament; test pending"
  },
  {
    "id": "purple",
    "label": "Purple",
    "hex": "#5f3ba8",
    "filament": "SUNLU Purple",
    "filamentStatus": "on-hand"
  },
  {
    "id": "violet",
    "label": "Violet",
    "hex": "#7a4bd8",
    "filament": "SUNLU Purple",
    "filamentStatus": "on-hand",
    "filamentNote": "Closest stocked violet"
  },
  {
    "id": "pink",
    "label": "Pink",
    "hex": "#e88abf",
    "filament": "Pink \u2014 not stocked",
    "filamentStatus": "missing"
  },
  {
    "id": "magenta",
    "label": "Magenta",
    "hex": "#c83cb9",
    "filament": "SUNLU Red",
    "filamentStatus": "substitute",
    "filamentNote": "Current closest stocked substitute"
  },
  {
    "id": "brown",
    "label": "Brown",
    "hex": "#6f4a2c",
    "filament": "SUNLU Coffee Brown",
    "filamentStatus": "on-hand"
  },
  {
    "id": "tan",
    "label": "Tan",
    "hex": "#c6a56f",
    "filament": "SUNLU Tan",
    "filamentStatus": "on-hand"
  }
];

  window.WestTechNFLSingleTeamProfiles = {
  "ARI": {
    "field": "white",
    "nameRing": "white",
    "ringText": "red",
    "accentRing": "red",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "ATL": {
    "field": "red",
    "nameRing": "white",
    "ringText": "red",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "BAL": {
    "field": "purple",
    "nameRing": "white",
    "ringText": "purple",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "BUF": {
    "field": "royal-blue",
    "nameRing": "white",
    "ringText": "royal-blue",
    "accentRing": "red",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "CAR": {
    "field": "gray",
    "nameRing": "white",
    "ringText": "light-blue",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "CHI": {
    "field": "white",
    "nameRing": "white",
    "ringText": "black",
    "accentRing": "orange",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "CIN": {
    "field": "orange",
    "nameRing": "white",
    "ringText": "orange",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "CLE": {
    "field": "orange",
    "nameRing": "white",
    "ringText": "orange",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "DAL": {
    "field": "royal-blue",
    "nameRing": "white",
    "ringText": "royal-blue",
    "accentRing": "gray",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "DEN": {
    "field": "orange",
    "nameRing": "white",
    "ringText": "royal-blue",
    "accentRing": "royal-blue",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "DET": {
    "field": "royal-blue",
    "nameRing": "white",
    "ringText": "royal-blue",
    "accentRing": "gray",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "GB": {
    "field": "dark-green",
    "nameRing": "white",
    "ringText": "dark-green",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "HOU": {
    "field": "white",
    "nameRing": "white",
    "ringText": "navy",
    "accentRing": "dark-red",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "IND": {
    "field": "white",
    "nameRing": "white",
    "ringText": "royal-blue",
    "accentRing": "royal-blue",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "JAX": {
    "field": "teal",
    "nameRing": "white",
    "ringText": "black",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "KC": {
    "field": "red",
    "nameRing": "white",
    "ringText": "red",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "LV": {
    "field": "gray",
    "nameRing": "white",
    "ringText": "black",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "LAC": {
    "field": "light-blue",
    "nameRing": "white",
    "ringText": "light-blue",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "LAR": {
    "field": "royal-blue",
    "nameRing": "white",
    "ringText": "royal-blue",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "MIA": {
    "field": "white",
    "nameRing": "white",
    "ringText": "teal",
    "accentRing": "orange",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "MIN": {
    "field": "purple",
    "nameRing": "white",
    "ringText": "purple",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "NE": {
    "field": "white",
    "nameRing": "white",
    "ringText": "navy",
    "accentRing": "red",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "NO": {
    "field": "black",
    "nameRing": "white",
    "ringText": "black",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "NYG": {
    "field": "navy",
    "nameRing": "white",
    "ringText": "navy",
    "accentRing": "dark-red",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "NYJ": {
    "field": "white",
    "nameRing": "white",
    "ringText": "dark-green",
    "accentRing": "dark-green",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "PHI": {
    "field": "dark-green",
    "nameRing": "white",
    "ringText": "dark-green",
    "accentRing": "gray",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "PIT": {
    "field": "black",
    "nameRing": "white",
    "ringText": "black",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "SF": {
    "field": "dark-red",
    "nameRing": "white",
    "ringText": "dark-red",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "SEA": {
    "field": "gray",
    "nameRing": "white",
    "ringText": "dark-green",
    "accentRing": "lime",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "TB": {
    "field": "red",
    "nameRing": "white",
    "ringText": "orange",
    "accentRing": "black",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "TEN": {
    "field": "navy",
    "nameRing": "white",
    "ringText": "navy",
    "accentRing": "light-blue",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  },
  "WAS": {
    "field": "dark-red",
    "nameRing": "white",
    "ringText": "dark-red",
    "accentRing": "yellow",
    "outline": "white",
    "logoOutlineEnabled": false,
    "logoOutline": "black",
    "approved": true,
    "notes": ""
  }
};
})();
