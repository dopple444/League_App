import { readFile } from 'node:fs/promises';

function fail(message) {
  throw new Error(message);
}

function validUtcDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function parseArguments(arguments_) {
  const values = {
    approvedImages: new Map(),
    currentDate: undefined,
    expiry: undefined,
    id: undefined,
    record: undefined,
  };

  for (let index = 0; index < arguments_.length; index += 1) {
    const option = arguments_[index];
    const value = arguments_[index + 1];
    if (value === undefined) {
      fail(`Missing value for ${option}.`);
    }
    index += 1;

    if (option === '--approved-image') {
      const separator = value.indexOf('=');
      if (separator <= 0 || separator === value.length - 1) {
        fail(`Invalid approved image mapping: ${value}.`);
      }
      const service = value.slice(0, separator);
      const image = value.slice(separator + 1);
      if (values.approvedImages.has(service)) {
        fail(`Duplicate approved image service: ${service}.`);
      }
      values.approvedImages.set(service, image);
    } else if (option === '--current-date') {
      values.currentDate = value;
    } else if (option === '--expiry') {
      values.expiry = value;
    } else if (option === '--id') {
      values.id = value;
    } else if (option === '--record') {
      values.record = value;
    } else {
      fail(`Unknown option: ${option}.`);
    }
  }

  for (const name of ['currentDate', 'expiry', 'id', 'record']) {
    if (!values[name]) {
      fail(`Missing required container-exception argument: ${name}.`);
    }
  }
  if (values.approvedImages.size === 0) {
    fail('At least one approved exception image is required.');
  }
  return values;
}

function exceptionSection(document, id) {
  const lines = document.replaceAll('\r\n', '\n').split('\n');
  const matchingHeadings = [];
  for (let index = 0; index < lines.length; index += 1) {
    const heading = lines[index].match(/^##\s+(\S+)(?:\s|$)/u);
    if (heading?.[1] === id) {
      matchingHeadings.push(index);
    }
  }
  if (matchingHeadings.length !== 1) {
    fail(`Expected exactly one level-two ${id} section, found ${matchingHeadings.length}.`);
  }

  const start = matchingHeadings[0];
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (/^##\s+/u.test(lines[index])) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end);
}

function structuredField(sectionLines, name) {
  const prefix = `- **${name}:**`;
  const fieldStarts = [];
  for (let index = 0; index < sectionLines.length; index += 1) {
    if (sectionLines[index].startsWith(prefix)) {
      fieldStarts.push(index);
    }
  }
  if (fieldStarts.length !== 1) {
    fail(`Expected exactly one structured ${name} field in the exception section.`);
  }

  const start = fieldStarts[0];
  let end = sectionLines.length;
  for (let index = start + 1; index < sectionLines.length; index += 1) {
    if (/^- \*\*[^*]+:\*\*/u.test(sectionLines[index])) {
      end = index;
      break;
    }
  }
  return sectionLines.slice(start, end).join('\n');
}

function validateRecord(document, policy) {
  const section = exceptionSection(document, policy.id);
  const expiryField = structuredField(section, 'Expiry');
  const expiryMatches = [...expiryField.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/gu)];
  if (expiryMatches.length !== 1 || expiryMatches[0][1] !== policy.expiry) {
    fail(
      `${policy.id} must contain exactly the approved expiry ${policy.expiry} in its Expiry field.`,
    );
  }

  const imagesField = structuredField(section, 'Images and services');
  const recordedPairs = [...imagesField.matchAll(/`([^`\r\n]+)`\s*\(\s*`([^`\r\n]+)`\s*\)/gu)].map(
    (match) => ({ image: match[1], service: match[2] }),
  );
  if (recordedPairs.length !== policy.approvedImages.size) {
    fail(
      `${policy.id} must record exactly ${policy.approvedImages.size} approved image/service mappings.`,
    );
  }

  const seenServices = new Set();
  for (const { image, service } of recordedPairs) {
    if (seenServices.has(service)) {
      fail(`${policy.id} contains a duplicate image mapping for ${service}.`);
    }
    seenServices.add(service);
    const approvedImage = policy.approvedImages.get(service);
    if (approvedImage === undefined || approvedImage !== image) {
      fail(`${policy.id} does not exactly match the approved image for ${service}.`);
    }
  }
  for (const service of policy.approvedImages.keys()) {
    if (!seenServices.has(service)) {
      fail(`${policy.id} does not record the approved ${service} image.`);
    }
  }
}

async function main() {
  try {
    const policy = parseArguments(process.argv.slice(2));
    if (!validUtcDate(policy.currentDate)) {
      fail(`Invalid current UTC date: ${policy.currentDate}.`);
    }
    if (!validUtcDate(policy.expiry)) {
      fail(`Invalid exception expiry: ${policy.expiry}.`);
    }

    const document = await readFile(policy.record, 'utf8');
    validateRecord(document, policy);
    if (policy.currentDate >= policy.expiry) {
      fail(`Container exception ${policy.id} expired on ${policy.expiry}.`);
    }

    process.stdout.write(
      `Validated ${policy.id} through ${policy.expiry} for ${policy.approvedImages.size} exact images.\n`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`Container exception validation failed: ${message}\n`);
    process.exitCode = 1;
  }
}

await main();
