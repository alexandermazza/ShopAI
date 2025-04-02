# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased] - 2024-04-01

### Added
- Initial Shopify App and Theme App Extension setup using Shopify CLI.
- Configured Node.js and npm environment.
- Established connection to development store (`productwisetest.myshopify.com`).
- Created this changelog file.

### Changed
- Removed default star rating component
- Added new "Ask Me Anything" search component
  - Created basic UI matching design
  - Added input handling and focus effects
  - Prepared structure for search functionality
- Refined "Ask Me Anything" search component UI:
  - Increased height of the search bar.
  - Added gradient border effect.
  - Replaced emoji icon with `✦` symbol and applied gradient.
  - Applied gradient to placeholder text.
  - Styled search bar into a pill shape.
  - Ensured consistent appearance during focus state.
  - Centered placeholder text vertically.

### Fixed
- Resolved issue where the extension section wasn't appearing in the Theme Editor by moving block file out of subdirectory and adding `extension_points` to `shopify.extension.toml`. 