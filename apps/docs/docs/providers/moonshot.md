---
sidebar_label: Moonshot
description: Configure Kimi models in ADTEC Code through Moonshot's OpenAI-compatible API.
keywords:
    - moonshot
    - moonshot ai
    - ADTEC Code
    - api provider
    - openai compatible
---

# Using Moonshot With ADTEC Code

ADTEC Code supports Kimi models through Moonshot's OpenAI-compatible API. The default international endpoint is `https://api.moonshot.ai/v1`.

**Website:** [https://platform.kimi.ai/](https://platform.kimi.ai/)

---

## Getting an API Key

1.  **Sign Up/Sign In:** Go to the [Kimi API Platform](https://platform.kimi.ai/). Create an account or sign in.
2.  **Navigate to API Keys:** Open the [API Keys](https://platform.kimi.ai/console/api-keys) page.
3.  **Create a Key:** Create a new API key. Give your key a descriptive name (e.g., "ADTEC Code").
4.  **Copy the Key:** **Important:** Copy the API key _immediately_. You will not be able to see it again. Store it securely.

---

## Available Models

ADTEC Code includes the current Kimi models and refreshes the model list from the configured `/models` endpoint when an API key is available.

| Model | Context | Description |
| --- | ---: | --- |
| `kimi-k3` | 1M tokens | Flagship multimodal model with always-on thinking. |
| `kimi-k2.7-code` | 256K tokens | Coding-focused model with always-on preserved thinking. |
| `kimi-k2.7-code-highspeed` | 256K tokens | K2.7 Code with higher output speed. |
| `kimi-k2.6` | 256K tokens | Multimodal model with selectable thinking and non-thinking modes. |
| `kimi-k2.5` | 256K tokens | Multimodal model with selectable thinking and non-thinking modes. |

For the complete, up-to-date model list and parameter constraints, see [Kimi's model documentation](https://platform.kimi.ai/docs/models).

---

## Configuration in ADTEC Code

1.  **Open ADTEC Code Settings:** Click the gear icon (<Codicon name="gear" />) in the ADTEC Code panel.
2.  **Select Provider:** Choose "Moonshot" from the "API Provider" dropdown.
3.  **Enter API Key:** Paste your Moonshot API key into the "Moonshot API Key" field.
4.  **Select Model:** Choose your desired model from the "Model" dropdown.

---

## Tips and Notes

- **OpenAI-Compatible:** Moonshot uses an OpenAI-compatible API format, making it easy to integrate with ADTEC Code.
- **Kimi K3 parameters:** K3 always reasons and accepts only `reasoning_effort: "max"`; ADTEC Code sends this automatically. K2.6 exposes the thinking toggle, while K2.7 Code always uses preserved thinking.
- **Pricing:** Refer to the Moonshot platform for details on model costs and pricing.
