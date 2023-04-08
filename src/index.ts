import { cwd } from "node:process";
import { join, parse } from "node:path";
import { isNativeError } from "node:util/types";

import chalk from "chalk";
import logSymbols from "log-symbols";
import { array as A, either as E, task as T, taskEither as TE } from "fp-ts";
import { identity, pipe } from "fp-ts/lib/function.js";
import { sequenceS } from "fp-ts/lib/Apply.js";
import { toUpperCase } from "fp-ts/lib/string.js";
import { objectKeys } from "ts-extras";

import {
	copySubtitlesFileForVideo,
	getSubsDirInDir,
	getSubtitlesInDir,
	getVideoFilesInDir,
	Subtitles,
} from "./helpers.js";

const ROOT_DIR = process.argv.at(2) ?? join(cwd(), ".");

function fixSubtitles(dir: string) {
	const getSubsDir = () => TE.tryCatch(() => getSubsDirInDir(dir), E.toError);
	const getVideos = () => TE.tryCatch(() => getVideoFilesInDir(dir), E.toError);

	const getSubs = (video: string, subsDir: string, isSolo: boolean) =>
		TE.tryCatch(
			() =>
				getSubtitlesInDir(!isSolo ? join(subsDir, parse(video).name) : subsDir),
			E.toError
		);

	const copySubs = (video: string, subtitle: Subtitles) =>
		TE.tryCatch(() => copySubtitlesFileForVideo(video, subtitle), E.toError);

	return pipe(
		sequenceS(TE.ApplicativePar)({
			subsDir: getSubsDir(),
			videos: getVideos(),
		}),
		TE.map(({ subsDir, videos }) =>
			pipe(
				videos,
				A.map(video =>
					pipe(
						getSubs(video, subsDir, videos.length === 1),
						TE.chainFirst(subtitle => copySubs(video, subtitle)),
						TE.matchW(
							error => ({ video, error }),
							subtitle => ({ video, subtitle })
						)
					)
				),
				T.sequenceArray
			)
		),
		TE.matchW(identity, async t => await t())
	)();
}

const res = await fixSubtitles(ROOT_DIR);

if (!isNativeError(res)) {
	res.forEach(it => {
		if ("subtitle" in it) {
			console.log(
				chalk.green(logSymbols.success, parse(it.video).base),
				chalk.gray(`[${objectKeys(it.subtitle).map(toUpperCase).join(",")}]`)
			);
		} else {
			console.log(
				chalk.red(logSymbols.error, parse(it.video).base),
				chalk.gray(`[${it.error.message}]`)
			);
		}
	});
} else {
	console.log(chalk.red(res.message));
}
