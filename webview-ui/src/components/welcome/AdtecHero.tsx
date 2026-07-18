const AdtecHero = () => {
	const iconsBaseUri = (() => {
		const w = window as any
		return w.IMAGES_BASE_URI || ""
	})()

	return (
		<div className="mb-4 flex h-24 w-24 items-center justify-center forced-color-adjust-none">
			<img
				src={`${iconsBaseUri}/adtec-logo.png`}
				alt="ADTEC Code"
				className="h-24 w-24 object-contain"
				data-testid="adtec-hero"
			/>
		</div>
	)
}

export default AdtecHero
