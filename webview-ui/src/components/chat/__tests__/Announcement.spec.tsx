import { render } from "@/utils/test-utils"

import Announcement from "../Announcement"

describe("Announcement", () => {
	it("does not render retired announcement content", () => {
		const { container } = render(<Announcement hideAnnouncement={vi.fn()} />)
		expect(container).toBeEmptyDOMElement()
	})
})
