// vocs.config.ts
import { defineConfig } from "file:///Users/felipesousapessina/Documents/near/signet.js/node_modules/.pnpm/vocs@1.0.0-alpha.62_@types+node@22.7.3_@types+react@18.3.18_acorn@8.12.1_react-dom@18.3.1_rea_svfoonwm5ltzrgxtljyx3n4sem/node_modules/vocs/_lib/index.js";
var vocs_config_default = defineConfig({
  title: "Signet.js",
  description: "A TypeScript library for handling multi-chain transactions and signatures using MPC",
  twoslash: {
    compilerOptions: {
      strict: true,
      module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node,
      target: ts.ScriptTarget.ES2020,
      baseUrl: ".",
      paths: {
        "signet.js": ["./src"],
        "@/*": ["./src/*"]
      }
    }
  },
  sidebar: [
    {
      text: "Getting Started",
      items: [
        { text: "Overview", link: "/" },
        { text: "Sig Network", link: "/sig-net" }
      ]
    },
    {
      text: "Supported Chains",
      items: [
        { text: "EVM Chains", link: "/chains/evm" },
        { text: "Bitcoin", link: "/chains/bitcoin" },
        { text: "Cosmos", link: "/chains/cosmos" }
      ]
    },
    {
      text: "Core Concepts",
      items: [
        { text: "Chain Interface", link: "/guides/implementing-new-chain" },
        { text: "MPC Overview", link: "/guides/mpc-overview" }
      ]
    },
    {
      text: "Implementation Guides",
      collapsed: true,
      items: [
        {
          text: "Creating a New Chain",
          link: "/guides/implementing-new-chain"
        },
        {
          text: "Bitcoin RPC Adapter",
          link: "/guides/implementing-btc-adapter"
        },
        {
          text: "Chain Signature Contract",
          link: "/guides/implementing-signature-contract"
        }
      ]
    }
  ],
  socials: [
    {
      icon: "github",
      link: "https://github.com/near/signet.js"
    }
  ],
  theme: {
    accentColor: {
      light: "#00C08B",
      dark: "#00E6A6"
    }
  }
});
export {
  vocs_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidm9jcy5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvZmVsaXBlc291c2FwZXNzaW5hL0RvY3VtZW50cy9uZWFyL3NpZ25ldC5qc1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2ZlbGlwZXNvdXNhcGVzc2luYS9Eb2N1bWVudHMvbmVhci9zaWduZXQuanMvdm9jcy5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2ZlbGlwZXNvdXNhcGVzc2luYS9Eb2N1bWVudHMvbmVhci9zaWduZXQuanMvdm9jcy5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcsIHR5cGUgQ29uZmlnIH0gZnJvbSAndm9jcydcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgdGl0bGU6ICdTaWduZXQuanMnLFxuICBkZXNjcmlwdGlvbjpcbiAgICAnQSBUeXBlU2NyaXB0IGxpYnJhcnkgZm9yIGhhbmRsaW5nIG11bHRpLWNoYWluIHRyYW5zYWN0aW9ucyBhbmQgc2lnbmF0dXJlcyB1c2luZyBNUEMnLFxuICB0d29zbGFzaDoge1xuICAgIGNvbXBpbGVyT3B0aW9uczoge1xuICAgICAgc3RyaWN0OiB0cnVlLFxuICAgICAgbW9kdWxlOiB0cy5Nb2R1bGVLaW5kLkNvbW1vbkpTLFxuICAgICAgbW9kdWxlUmVzb2x1dGlvbjogdHMuTW9kdWxlUmVzb2x1dGlvbktpbmQuTm9kZSxcbiAgICAgIHRhcmdldDogdHMuU2NyaXB0VGFyZ2V0LkVTMjAyMCxcbiAgICAgIGJhc2VVcmw6ICcuJyxcbiAgICAgIHBhdGhzOiB7XG4gICAgICAgICdzaWduZXQuanMnOiBbJy4vc3JjJ10sXG4gICAgICAgICdALyonOiBbJy4vc3JjLyonXSxcbiAgICAgIH0sXG4gICAgfSxcbiAgfSxcbiAgc2lkZWJhcjogW1xuICAgIHtcbiAgICAgIHRleHQ6ICdHZXR0aW5nIFN0YXJ0ZWQnLFxuICAgICAgaXRlbXM6IFtcbiAgICAgICAgeyB0ZXh0OiAnT3ZlcnZpZXcnLCBsaW5rOiAnLycgfSxcbiAgICAgICAgeyB0ZXh0OiAnU2lnIE5ldHdvcmsnLCBsaW5rOiAnL3NpZy1uZXQnIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgdGV4dDogJ1N1cHBvcnRlZCBDaGFpbnMnLFxuICAgICAgaXRlbXM6IFtcbiAgICAgICAgeyB0ZXh0OiAnRVZNIENoYWlucycsIGxpbms6ICcvY2hhaW5zL2V2bScgfSxcbiAgICAgICAgeyB0ZXh0OiAnQml0Y29pbicsIGxpbms6ICcvY2hhaW5zL2JpdGNvaW4nIH0sXG4gICAgICAgIHsgdGV4dDogJ0Nvc21vcycsIGxpbms6ICcvY2hhaW5zL2Nvc21vcycgfSxcbiAgICAgIF0sXG4gICAgfSxcbiAgICB7XG4gICAgICB0ZXh0OiAnQ29yZSBDb25jZXB0cycsXG4gICAgICBpdGVtczogW1xuICAgICAgICB7IHRleHQ6ICdDaGFpbiBJbnRlcmZhY2UnLCBsaW5rOiAnL2d1aWRlcy9pbXBsZW1lbnRpbmctbmV3LWNoYWluJyB9LFxuICAgICAgICB7IHRleHQ6ICdNUEMgT3ZlcnZpZXcnLCBsaW5rOiAnL2d1aWRlcy9tcGMtb3ZlcnZpZXcnIH0sXG4gICAgICBdLFxuICAgIH0sXG4gICAge1xuICAgICAgdGV4dDogJ0ltcGxlbWVudGF0aW9uIEd1aWRlcycsXG4gICAgICBjb2xsYXBzZWQ6IHRydWUsXG4gICAgICBpdGVtczogW1xuICAgICAgICB7XG4gICAgICAgICAgdGV4dDogJ0NyZWF0aW5nIGEgTmV3IENoYWluJyxcbiAgICAgICAgICBsaW5rOiAnL2d1aWRlcy9pbXBsZW1lbnRpbmctbmV3LWNoYWluJyxcbiAgICAgICAgfSxcbiAgICAgICAge1xuICAgICAgICAgIHRleHQ6ICdCaXRjb2luIFJQQyBBZGFwdGVyJyxcbiAgICAgICAgICBsaW5rOiAnL2d1aWRlcy9pbXBsZW1lbnRpbmctYnRjLWFkYXB0ZXInLFxuICAgICAgICB9LFxuICAgICAgICB7XG4gICAgICAgICAgdGV4dDogJ0NoYWluIFNpZ25hdHVyZSBDb250cmFjdCcsXG4gICAgICAgICAgbGluazogJy9ndWlkZXMvaW1wbGVtZW50aW5nLXNpZ25hdHVyZS1jb250cmFjdCcsXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgIH0sXG4gIF0sXG5cbiAgc29jaWFsczogW1xuICAgIHtcbiAgICAgIGljb246ICdnaXRodWInLFxuICAgICAgbGluazogJ2h0dHBzOi8vZ2l0aHViLmNvbS9uZWFyL3NpZ25ldC5qcycsXG4gICAgfSxcbiAgXSxcblxuICB0aGVtZToge1xuICAgIGFjY2VudENvbG9yOiB7XG4gICAgICBsaWdodDogJyMwMEMwOEInLFxuICAgICAgZGFyazogJyMwMEU2QTYnLFxuICAgIH0sXG4gIH0sXG59KSBhcyBDb25maWdcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1UsU0FBUyxvQkFBaUM7QUFFbFgsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsT0FBTztBQUFBLEVBQ1AsYUFDRTtBQUFBLEVBQ0YsVUFBVTtBQUFBLElBQ1IsaUJBQWlCO0FBQUEsTUFDZixRQUFRO0FBQUEsTUFDUixRQUFRLEdBQUcsV0FBVztBQUFBLE1BQ3RCLGtCQUFrQixHQUFHLHFCQUFxQjtBQUFBLE1BQzFDLFFBQVEsR0FBRyxhQUFhO0FBQUEsTUFDeEIsU0FBUztBQUFBLE1BQ1QsT0FBTztBQUFBLFFBQ0wsYUFBYSxDQUFDLE9BQU87QUFBQSxRQUNyQixPQUFPLENBQUMsU0FBUztBQUFBLE1BQ25CO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxFQUFFLE1BQU0sWUFBWSxNQUFNLElBQUk7QUFBQSxRQUM5QixFQUFFLE1BQU0sZUFBZSxNQUFNLFdBQVc7QUFBQSxNQUMxQztBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixPQUFPO0FBQUEsUUFDTCxFQUFFLE1BQU0sY0FBYyxNQUFNLGNBQWM7QUFBQSxRQUMxQyxFQUFFLE1BQU0sV0FBVyxNQUFNLGtCQUFrQjtBQUFBLFFBQzNDLEVBQUUsTUFBTSxVQUFVLE1BQU0saUJBQWlCO0FBQUEsTUFDM0M7QUFBQSxJQUNGO0FBQUEsSUFDQTtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sT0FBTztBQUFBLFFBQ0wsRUFBRSxNQUFNLG1CQUFtQixNQUFNLGlDQUFpQztBQUFBLFFBQ2xFLEVBQUUsTUFBTSxnQkFBZ0IsTUFBTSx1QkFBdUI7QUFBQSxNQUN2RDtBQUFBLElBQ0Y7QUFBQSxJQUNBO0FBQUEsTUFDRSxNQUFNO0FBQUEsTUFDTixXQUFXO0FBQUEsTUFDWCxPQUFPO0FBQUEsUUFDTDtBQUFBLFVBQ0UsTUFBTTtBQUFBLFVBQ04sTUFBTTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsVUFDRSxNQUFNO0FBQUEsVUFDTixNQUFNO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxVQUNFLE1BQU07QUFBQSxVQUNOLE1BQU07QUFBQSxRQUNSO0FBQUEsTUFDRjtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFFQSxTQUFTO0FBQUEsSUFDUDtBQUFBLE1BQ0UsTUFBTTtBQUFBLE1BQ04sTUFBTTtBQUFBLElBQ1I7QUFBQSxFQUNGO0FBQUEsRUFFQSxPQUFPO0FBQUEsSUFDTCxhQUFhO0FBQUEsTUFDWCxPQUFPO0FBQUEsTUFDUCxNQUFNO0FBQUEsSUFDUjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
