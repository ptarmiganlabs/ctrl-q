# Things related to documentation of Ctrl-Q

- [Things related to documentation of Ctrl-Q](#things-related-to-documentation-of-ctrl-q)
  - [Process for creating terminal captures](#process-for-creating-terminal-captures)

## Process for creating terminal captures

Note: This process only works on macOS and Linux.  
The tools used do not support Windows.

The steps on macOS are

1. Install Asciinema
   1. https://asciinema.org/docs/getting-started
   2. `brew install asciinema`
2. Install svg-term-cli
   1. This tool is a bit dated... But can't find a better solution right now.
   2. https://www.npmjs.com/package/svg-term-cli
   3. `npm install -g svg-term-cli`
3. Change terminal to truncate long lines
   1. Makes the tables created by Ctrl-Q look better in the captured file
   2. `tput rmam`
4. Do terminal capture
   1. `asciinema rec`
   2. Finish by pressing ctrl-d
   3. Upload the capture to asciinema.org
   4. Note the capture id (it will be needed in a minute)
5. Change terminal back to NOT truncating long lines
   1. `tput smam`
6. Create SVG
   1. `svg-term --cast=<captureid> --out <outputname>.svg --window`
