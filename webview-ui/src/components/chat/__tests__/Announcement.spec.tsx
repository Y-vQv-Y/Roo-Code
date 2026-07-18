import { render } from "@/utils/test-utils"

import Announcement from "../Announcement"

describe("Announcement", () => {
	it("does not render retired announcement content", () => {
		render(<Announcement hideAnnouncement={vi.fn()} />)
		expect(document.body).toBeEmptyDOMElement()
	})
})
