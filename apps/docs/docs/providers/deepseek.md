---
sidebar_label: DeepSeek
description: Configure DeepSeek V4-Pro and V4-Flash in ADTEC Code through DeepSeek's OpenAI-compatible API.
keywords:
    - deepseek
    - deepseek v4
    - deepseek v4 pro
    - deepseek v4 flash
    - ADTEC Code
    - api provider
    - reasoning ai
    - coding ai
---

# Using DeepSeek With ADTEC Code

ADTEC Code supports the current DeepSeek V4 models: `deepseek-v4-pro` and `deepseek-v4-flash`.

**Website:** [https://platform.deepseek.com/](https://platform.deepseek.com/)

---

## Getting an API Key

1.  **Sign Up/Sign In:** Go to the [DeepSeek Platform](https://platform.deepseek.com/). Create an account or sign in.
2.  **Navigate to API Keys:** Find your API keys in the [API keys](https://platform.deepseek.com/api_keys) section of the platform.
3.  **Create a Key:** Click "Create new API key". Give your key a descriptive name (e.g., "ADTEC Code").
4.  **Copy the Key:** **Important:** Copy the API key _immediately_. You will not be able to see it again. Store it securely.

---

## Available Models

| Model | Context | Maximum output | Description |
| --- | ---: | ---: | --- |
| `deepseek-v4-pro` | 1M tokens | 384K tokens | Flagship model with thinking and non-thinking modes. |
| `deepseek-v4-flash` | 1M tokens | 384K tokens | Faster model with thinking and non-thinking modes. |

Both models support JSON output and tool calls. ADTEC Code uses DeepSeek's OpenAI-compatible base URL `https://api.deepseek.com`. DeepSeek also publishes an Anthropic-compatible endpoint at `https://api.deepseek.com/anthropic` for clients that use the Anthropic protocol.

For the complete, up-to-date model list, see [DeepSeek's API documentation](https://api-docs.deepseek.com/quick_start/pricing).

---

## Configuration in ADTEC Code

1.  **Open ADTEC Code Settings:** Click the gear icon (<Codicon name="gear" />) in the ADTEC Code panel.
2.  **Select Provider:** Choose "DeepSeek" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your DeepSeek API key into the "DeepSeek API Key" field.
4.  **Select Model:** Choose your desired model from the "Model" dropdown.

---

## Tips and Notes

- **Pricing:** Refer to the [DeepSeek Pricing](https://api-docs.deepseek.com/quick_start/pricing/) page for details on model costs.
