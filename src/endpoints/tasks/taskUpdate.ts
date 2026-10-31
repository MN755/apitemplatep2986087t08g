import { D1UpdateEndpoint } from "chanfana";
import { HandleArgs } from "../../types";
import { TaskModel } from "./base";

export class TaskUpdate extends D1UpdateEndpoint<HandleArgs> {
	_meta = {
		model: TaskModel,
		// Chanfana 3 omits URL primary keys from this schema before validating the body.
		fields: TaskModel.schema.pick({
			id: true,
			name: true,
			slug: true,
			description: true,
			completed: true,
			due_date: true,
		}),
	};
}
