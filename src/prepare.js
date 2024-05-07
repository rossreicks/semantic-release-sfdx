import { getPackage } from "./util.js";
import sfdx from "sfdx-node";
import fs from "node:fs";
import path from "node:path";
import find from "lodash.find";

export const prepare = async (
	pluginConfig,
	{ nextRelease: { version }, logger },
) => {
	const packageVersion = `${version}.0`;

	const project = JSON.parse(fs.readFileSync("sfdx-project.json"));

	const pkg = getPackage(project);

	logger.log(`Creating new package version ${pkg.package}:${packageVersion}`);

	const versionCreateOptions = {
		_rejectOnError: true,
		path: pkg.path,
		tag: version,
		versionnumber: packageVersion,
		json: true,
		wait: pluginConfig.versionCreateWait || 15,
        definitionfile: pluginConfig.definitionfile
	};

	if (pluginConfig.installationkey) {
		versionCreateOptions.installationkey = pluginConfig.installationkey;
	} else {
		versionCreateOptions.installationkeybypass = true;
	}

	if (pluginConfig.codecoverage) {
		versionCreateOptions.codecoverage = true;
	}

	const createResult =
		await sfdx.force.package.versionCreate(versionCreateOptions);

    logger.log('Package Version Create Result: ' + JSON.stringify(createResult));

    const { subscriberPackageVersionId } = createResult;

	const list = await sfdx.force.package.versionList();

    logger.log('Package Version List: ' + JSON.stringify(list));

	const latestResult = find(list, { SubscriberPackageVersionId: subscriberPackageVersionId });

	logger.log(`Package Version Create Result: ${JSON.stringify(latestResult)}`);

	if (pluginConfig.promote) {
		logger.log("Promoting Package Version");
		await sfdx.force.package.versionPromote({
			_rejectOnError: true,
			package: latestResult.SubscriberPackageVersionId,
			noprompt: true,
			json: true,
		});
	}

    try {
        const nextVersion = `${version}.NEXT`;

        pkg.versionNumber = nextVersion;

        if (!project.packageAliases) {
            project.packageAliases = {};
        }

        if (subscriberPackageVersionId) {
            project.packageAliases[`${pkg.package}@${version}-0`] = subscriberPackageVersionId;
        }

        fs.writeFileSync("sfdx-project.json", JSON.stringify(project, null, 2));
    } catch {
        logger.error("Failed to update sfdx-project.json");
    }
};