import { memo } from "react"

interface AnnouncementProps {
	hideAnnouncement: () => void
}

const Announcement = ({ hideAnnouncement }: AnnouncementProps) => {
	void hideAnnouncement
	return null
}

export default memo(Announcement)
