import { cwd } from "node:process";
import { join, parse } from "node:path";

import chalk from "chalk";
import logSymbols from "log-symbols";
import { array as A, either as E, task as T, taskEither as TE } from "fp-ts";
import { pipe } from "fp-ts/lib/function.js";
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

type SubtitleOkResult = { video: string; subtitle: Subtitles }
type SubtitleErrorResult = { video: string; error: Error }
type SubtitleResult = SubtitleOkResult | SubtitleErrorResult

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
							error => ({ video, error }) as SubtitleErrorResult,
							subtitle => ({ video, subtitle }) as SubtitleOkResult
						)
					)
				),
				T.sequenceArray
			)
		),
		TE.match(handleError, async t => handleResults(await t()))
	)();
}

function handleError(error: Error){
	console.log(chalk.red(error.message));
	return process.exit(1);	
}

function handleResults(results: ReadonlyArray<SubtitleResult>) {
	results.forEach(it => {
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
}

fixSubtitles(ROOT_DIR)



