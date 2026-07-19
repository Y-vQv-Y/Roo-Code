# ADTEC Code CLI

The ADTEC Code CLI runs the same agent workflow from a terminal.

## Local Installation

Build artifacts are distributed internally. Install a supplied tarball with:

```sh
ADTEC_CODE_LOCAL_TARBALL=/path/to/adtec-code-cli.tar.gz ./install.sh
```

The default executable is `adtec-code` and the default data directory is `~/.adtec/cli`.

## Usage

```sh
adtec-code "Summarize this repository"
adtec-code --print "Explain the current changes"
adtec-code --help
```

The CLI uses the same provider and model metadata as the VS Code extension. Select a provider and model explicitly when needed, or let the provider default be used:

```sh
adtec-code --provider deepseek --model deepseek-v4-pro "Review this change"
adtec-code --provider openai --base-url https://api.openai.com/v1 --model gpt-5.6-sol "Fix the failing test"
adtec-code --provider ollama --model llama3.3 "Explain this file"
```

Use the provider API to discover live models and inspect bundled/user skills:

```sh
adtec-code list models --provider openrouter --format text
adtec-code list models --provider ollama --format json
adtec-code list skills --format text
```

`--context-window` accepts a token budget such as `128000`, `200000`, `512000`, or `1000000`. The selected model's reported limit always caps the effective budget, and the shared agent automatically compresses history when that budget is reached.

An internal release service can be configured with `ADTEC_CODE_RELEASE_REPOSITORY`, `ADTEC_CODE_RELEASES_URL`, and `ADTEC_CODE_INSTALL_COMMAND`.
