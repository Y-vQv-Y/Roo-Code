const builtInModeSlugs = new Set(["architect", "code", "ask", "debug", "orchestrator"])

type Translate = (key: string, options?: { defaultValue?: string }) => string

export const getLocalizedModeDescription = (t: Translate, slug: string, fallback = ""): string => {
	if (!builtInModeSlugs.has(slug)) {
		return fallback
	}

	const key = `chat:modeSelector.builtInModeDescriptions.${slug}`
	const translated = t(key, { defaultValue: fallback })

	return translated === key ? fallback : translated
}
