import { extname, join, parse } from "node:path";
import { copyFile, readdir } from "node:fs/promises";

import { objectEntries, objectFromEntries } from "ts-extras";

const LANGUAGE = "English";
const LANGUAGE_CODE = "en";
const VIDEO_EXTS = [".mkv", ".mp4"];

export type SubtitleType = "full" | "sdh" | "forced";
export type Subtitles = {
	[k in SubtitleType]?: string;
};

export async function getSubsDirInDir(dir: string) {
	const [folder] = await readdir(dir, { withFileTypes: true })
		.then(d =>
			d
				.filter(it => it.isDirectory())
				.map(it => it.name)
				.filter(it => it.toLowerCase() === "subs")
		)
		.catch(() => []);

	if (!folder) {
		throw Error("Subs folder not found");
	}

	return join(dir, folder);
}

export async function getVideoFilesInDir(dir: string) {
	const files = await readdir(dir, { withFileTypes: true }).then(d =>
		d
			.filter(it => !it.isDirectory())
			.map(it => it.name)
			.filter(it => VIDEO_EXTS.includes(extname(it)))
			.map(it => join(dir, it))
	);

	if (files.length < 1) {
		throw Error("No video files found");
	}

	return files;
}

export async function getSubtitlesInDir(dir: string): Promise<Subtitles> {
	const files = await readdir(dir, {
		withFileTypes: true,
	}).then(d =>
		d
			.filter(it => !it.isDirectory())
			.map(it => it.name)
			.filter(it => extname(it).toLowerCase() === ".srt")
			.filter(it => it.toLowerCase().includes(LANGUAGE.toLowerCase()))
			.map(it => join(dir, it))
	);

	if (!files.length) {
		throw Error(`No suitable subtitle found in directory ${parse(dir).base}`);
	}

	const findSubs = (includedText: string) =>
		files.find(f => f.toLowerCase().includes(includedText));

	const subs = {
		full: findSubs(`2_${LANGUAGE.toLowerCase()}`),
		sdh: findSubs(`3_${LANGUAGE.toLowerCase()}`),
		forced: findSubs(`4_${LANGUAGE.toLowerCase()}`),
	} satisfies Subtitles;

	return objectFromEntries(
		objectEntries(subs).filter(([_, v]) => v !== undefined)
	);
}

export async function copySubtitlesFileForVideo(
	video: string,
	subtitles: Subtitles
) {
	const getSubtitleSuffix = (type: SubtitleType) =>
		`.${LANGUAGE_CODE}${type !== "full" ? `.${type}` : ""}`;

	return Promise.all(
		objectEntries(subtitles).map(([type, subtitle]) =>
			copyFile(
				subtitle!,
				join(
					parse(video).dir,
					`${parse(video).name}${getSubtitleSuffix(type)}${
						parse(subtitle!).ext
					}`
				)
			)
		)
	);
}
