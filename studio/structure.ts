import type {DefaultDocumentNodeResolver, StructureResolver} from 'sanity/structure'
import {workflowsView} from '@sanity/workflow-studio-plugin'
import {ReceiptsView} from './components/ReceiptsView'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('The Tattler')
    .items([
      S.listItem()
        .title('On the desk')
        .child(S.documentList().title('On the desk').filter('_type == "story" && !defined(printedAt)')),
      S.listItem()
        .title('Printed')
        .child(
          S.documentList()
            .title('Printed')
            .filter('_type == "story" && defined(printedAt)')
            .defaultOrdering([{field: 'edition', direction: 'desc'}]),
        ),
      S.divider(),
      S.listItem()
        .title('Records')
        .child(
          S.list()
            .title('Records')
            .items(
              ['tale', 'letter', 'message', 'talk'].map((kind) =>
                S.listItem()
                  .title(`${kind[0].toUpperCase()}${kind.slice(1)}s`)
                  .child(
                    S.documentList()
                      .title(`${kind}s`)
                      .filter('_type == "record" && kind == $kind')
                      .params({kind})
                      .defaultOrdering([{field: 'tick', direction: 'desc'}]),
                  ),
              ),
            ),
        ),
      S.documentTypeListItem('pawn').title('Pawns'),
      S.listItem().title('Colony').child(S.document().schemaType('colony').documentId('colony')),
    ])

export const defaultDocumentNode: DefaultDocumentNodeResolver = (S, {schemaType}) => {
  if (schemaType === 'story') {
    return S.document().views([
      S.view.form(),
      S.view.component(ReceiptsView).id('receipts').title('Receipts'),
      workflowsView(S),
    ])
  }
  return S.document().views([S.view.form(), workflowsView(S)])
}
