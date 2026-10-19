export const isFrench = (typeof document === 'undefined' ? 'fr' : document.documentElement.lang).startsWith('fr');
export const locale = isFrench ? 'fr-FR' : 'en-US';

const french = {
  'Choose a PDF smaller than 100 MB.': 'Choisissez un PDF de moins de 100 Mo.',
  'Please choose a PDF smaller than 100 MB. Large files may also exceed your device’s memory.': 'Choisissez un PDF de moins de 100 Mo. Les fichiers volumineux peuvent dépasser la mémoire disponible sur votre appareil.',
  'This file is empty. Please choose another PDF.': 'Ce fichier est vide. Choisissez un autre PDF.',
  'This does not appear to be a PDF. Please choose a valid PDF file.': 'Ce fichier ne semble pas être un PDF. Choisissez un fichier PDF valide.',
  'This file does not appear to be a PDF. Please choose a valid PDF.': 'Ce fichier ne semble pas être un PDF. Choisissez un PDF valide.',
  'We could not read this file. Please choose it again.': 'Impossible de lire ce fichier. Sélectionnez-le à nouveau.',
  'Please select one PDF at a time.': 'Sélectionnez un seul PDF à la fois.',
  'Optimizes PDF structure without deliberately changing image pixels. Already optimized files may not shrink.': 'Optimise la structure du PDF sans modifier les pixels des images. Un fichier déjà optimisé peut ne pas diminuer.',
  'Keeps image dimensions and optimizes supported photos. Some image detail may change. Text and vector graphics stay sharp.': 'Conserve les dimensions des images et optimise les photos compatibles. Certains détails peuvent changer. Le texte et les graphiques vectoriels restent nets.',
  'Recompresses supported images and may resize large photos to 2,000 pixels on their longest edge. Fine image detail can change.': 'Recompresse les images compatibles et peut réduire leur plus grand côté à 2 000 pixels. Les détails fins peuvent être altérés.',
  'Cancelling…': 'Annulation…',
  'Preparing your PDF…': 'Préparation de votre PDF…',
  'Original kept': 'Original conservé',
  'Ready for a lighter download.': 'Votre PDF allégé est prêt.',
  'Your PDF is already doing well.': 'Votre PDF est déjà bien optimisé.',
  'This setting did not make your PDF smaller. Download your original, or try another compression level.': 'Ce réglage n’a pas réduit la taille du PDF. Téléchargez l’original ou essayez un autre niveau de compression.',
  'Compression cancelled.': 'Compression annulée.',
  'Compression cancelled. Your original file is unchanged.': 'Compression annulée. Votre fichier original reste intact.',
  'We could not compress this PDF. Try a different file or a desktop browser.': 'Impossible de compresser ce PDF. Essayez un autre fichier ou un navigateur sur ordinateur.',
  'This PDF is taking too long to process. Try a smaller file or use lossless mode.': 'Le traitement de ce PDF prend trop de temps. Essayez un fichier plus petit ou le mode sans perte.',
  'The browser could not process this PDF. Try a smaller file or a current desktop browser.': 'Le navigateur n’a pas pu traiter ce PDF. Essayez un fichier plus petit ou un navigateur récent sur ordinateur.',
  'Choose a valid compression setting.': 'Choisissez un réglage de compression valide.',
  'Reading your PDF locally…': 'Lecture du PDF sur votre appareil…',
  'Password-protected PDFs are not supported. Unlock a copy first, then try again.': 'Les PDF protégés par mot de passe ne sont pas pris en charge. Déverrouillez d’abord une copie, puis réessayez.',
  'This PDF could not be read. It may be damaged or use an unsupported format.': 'Impossible de lire ce PDF. Il est peut-être endommagé ou utilise un format non pris en charge.',
  'This PDF contains a digital signature. Compression would invalidate it, so the original has been left untouched.': 'Ce PDF contient une signature numérique. La compression l’invaliderait : votre original reste donc intact.',
  'This PDF contains an XFA form. To protect its behavior, this format is not supported.': 'Ce PDF contient un formulaire XFA. Pour préserver son fonctionnement, ce format n’est pas pris en charge.',
  'Image compression is not supported in this browser. Choose lossless mode or use a current browser.': 'Ce navigateur ne permet pas de compresser les images. Choisissez le mode sans perte ou un navigateur récent.',
  'Rebuilding the PDF structure…': 'Optimisation de la structure du PDF…',
  'Checking the result…': 'Vérification du résultat…',
  'The output could not be validated. Your original file is unchanged.': 'Le résultat n’a pas pu être validé. Votre fichier original reste intact.',
  'Ready to download': 'Prêt à télécharger',
  'This PDF could not be compressed. Try another file.': 'Impossible de compresser ce PDF. Essayez un autre fichier.',
};

// English engine diagnostics stay internal; the UI translates at its boundary.
export function t(message) {
  if (!isFrench || typeof message !== 'string') return message;
  if (french[message]) return french[message];
  const image = message.match(/^Optimizing image (\d+) of (\d+)…$/);
  if (image) return `Optimisation de l’image ${image[1]} sur ${image[2]}…`;
  return message;
}

export function formatSize(bytes) {
  const unit = bytes < 1024 ? (isFrench ? 'o' : 'B') : bytes < 1024 ** 2 ? (isFrench ? 'Ko' : 'KB') : (isFrench ? 'Mo' : 'MB');
  const amount = bytes < 1024 ? bytes : bytes < 1024 ** 2 ? bytes / 1024 : bytes / 1024 ** 2;
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: bytes < 1024 ? 0 : bytes < 1024 ** 2 ? 1 : 2 }).format(amount)} ${unit}`;
}

export function savingsText(originalSize, outputSize) {
  const percent = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format((1 - outputSize / originalSize) * 100);
  return isFrench ? `${percent} % de moins` : `${percent}% smaller`;
}

export function processedText(count) {
  return isFrench ? `${count} ${count === 1 ? 'page traitée' : 'pages traitées'}. Vérifiez votre PDF avant de le partager.` : `${count} ${count === 1 ? 'page' : 'pages'} processed. Review your PDF before sharing.`;
}
