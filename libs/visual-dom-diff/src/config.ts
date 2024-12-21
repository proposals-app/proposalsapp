import { DomIteratorOptions } from './domIterator'
import {
    diffText as diffTextDefault,
    DiffTextType,
    IndefiniteNodePredicate,
    isDocument,
    isDocumentFragment,
    isElement,
    isText,
    NodePredicate,
} from './util'

/**
 * The options for `visualDomDiff`.
 */
export interface Options {
    /**
     * The class name to use to mark up inserted content.
     * Default is `'vdd-added'`.
     */
    addedClass?: string
    /**
     * The class name to use to mark up modified content.
     * Default is `'vdd-modified'`.
     */
    modifiedClass?: string
    /**
     * The class name to use to mark up removed content.
     * Default is `'vdd-removed'`.
     */
    removedClass?: string
    /**
     * If `true`, the modified content (text formatting changes) will not be marked.
     * Default is `false`.
     */
    skipModified?: boolean
    /**
     * Indicates if the child nodes of the specified `node` should be ignored.
     * It is useful for ignoring child nodes of an element representing some embedded content,
     * which should not be compared. Return `undefined` for the default behaviour.
     */
    skipChildren?: IndefiniteNodePredicate
    /**
     * Indicates if the specified `node` should be ignored.
     * Even if the `node` is ignored, its child nodes will still be processed,
     * unless `skipChildNodes` says they should also be ignored.
     * Ignored elements whose child nodes are processed are treated as formatting elements.
     * Return `undefined` for the default behaviour.
     */
    skipSelf?: IndefiniteNodePredicate
    /**
     * A plain-text diff function, which is used internally to compare serialized
     * representations of DOM nodes, where each DOM element is represented by a single
     * character from the Private Use Area of the Basic Multilingual Unicode Plane. It defaults
     * to [diff_main](https://github.com/google/diff-match-patch/wiki/API#diff_maintext1-text2--diffs).
     */
    diffText?: DiffTextType
}

export interface Config extends Options, DomIteratorOptions {
    readonly addedClass: string
    readonly modifiedClass: string
    readonly removedClass: string
    readonly skipModified: boolean
    readonly skipChildren: NodePredicate
    readonly skipSelf: NodePredicate
    readonly diffText: DiffTextType
}

const skipChildrenMap = new Set()
skipChildrenMap.add('IMG')
skipChildrenMap.add('VIDEO')
skipChildrenMap.add('IFRAME')
skipChildrenMap.add('OBJECT')
skipChildrenMap.add('SVG')

const skipSelfMap = new Set()
skipSelfMap.add('BDO')
skipSelfMap.add('BDI')
skipSelfMap.add('Q')
skipSelfMap.add('CITE')
skipSelfMap.add('CODE')
skipSelfMap.add('DATA')
skipSelfMap.add('TIME')
skipSelfMap.add('VAR')
skipSelfMap.add('DFN')
skipSelfMap.add('ABBR')
skipSelfMap.add('STRONG')
skipSelfMap.add('EM')
skipSelfMap.add('BIG')
skipSelfMap.add('SMALL')
skipSelfMap.add('MARK')
skipSelfMap.add('SUB')
skipSelfMap.add('SUP')
skipSelfMap.add('SAMP')
skipSelfMap.add('KBD')
skipSelfMap.add('B')
skipSelfMap.add('I')
skipSelfMap.add('S')
skipSelfMap.add('U')
skipSelfMap.add('SPAN')

export function optionsToConfig({
    addedClass = 'vdd-added',
    modifiedClass = 'vdd-modified',
    removedClass = 'vdd-removed',
    skipModified = false,
    skipChildren,
    skipSelf,
    diffText = diffTextDefault,
}: Options = {}): Config {
    return {
        addedClass,
        diffText,
        modifiedClass,
        removedClass,
        skipModified,
        skipChildren(node: Node): boolean {
            if (
                !isElement(node) &&
                !isDocumentFragment(node) &&
                !isDocument(node)
            ) {
                return true
            }

            if (skipChildren) {
                const result = skipChildren(node)
                if (typeof result === 'boolean') {
                    return result
                }
            }

            return skipChildrenMap.has(node.nodeName)
        },
        skipSelf(node: Node): boolean {
            if (!isText(node) && !isElement(node)) {
                return true
            }

            if (skipSelf) {
                const result = skipSelf(node)
                if (typeof result === 'boolean') {
                    return result
                }
            }
            return skipSelfMap.has(node.nodeName)
        },
    }
}
