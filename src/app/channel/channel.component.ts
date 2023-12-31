import { Component, OnInit, ViewChild } from '@angular/core';
import { CollectionReference, DocumentData, Firestore, addDoc, collection, collectionData, doc, docData, getDoc, getDocs, onSnapshot, orderBy, query } from '@angular/fire/firestore';
import { ActivatedRoute } from '@angular/router';
import { Observable } from 'rxjs';
import { Channel } from 'src/models/channel.class';
import { Message } from 'src/models/message.class';
import { EditorComponent } from '../editor/editor.component';
import { AuthService } from '../shared/auth.service';
import { User } from 'src/models/user.class';
import { OpenThreadService } from '../shared/open-thread.service';
import { MessageService } from '../shared/message.service';
import { SearchTermService } from '../shared/search-term.service';

@Component({
   selector: 'app-channel',
   templateUrl: './channel.component.html',
   styleUrls: ['./channel.component.scss']
})
export class ChannelComponent implements OnInit {

   private coll: CollectionReference<DocumentData>;
   docRef: any;

   channel: Channel = new Channel;
   channelId = '';
   channels$: Observable<any>;

   messages: Message[] = [];
   messagesRef: any;
   messages$: Observable<any>;
   allMessages: { id: string, message: string, user: string, timestamp: number, imagePath: string, userId: string, answersCount: number }[] = [];
   filteredMessages: { id: string, message: string, user: string, timestamp: number, imagePath: string, userId: string, answersCount: number }[] = [];


   answers: Message[] = [];
   answersRef: any;
   answers$: Observable<any>;

   private userColl: CollectionReference<DocumentData>;
   userRef: any;
   userData$: Observable<User>;
   user: User;

   idCurrentUser: string;

   constructor(private searchTerm: SearchTermService, private route: ActivatedRoute, private firestore: Firestore, private auth: AuthService, private openThreadService: OpenThreadService, private messageService: MessageService) {
      this.coll = collection(this.firestore, 'channels');
      this.userColl = collection(this.firestore, 'users');
   }


   // initializes the component, retrieves necessary data, and sets up event listeners for updates
   ngOnInit(): void {
      this.route.paramMap.subscribe(paramMap => {
         const id = paramMap.get('id');
         if (id) {
            this.channelId = id.trim();
            this.getChannel();
            this.getMessages();
            this.getUser();
            this.messageService.messageAdded$.subscribe(() => {
               this.updateAnswersCount();
            });
         }
      });

      this.searchTerm.searchTermChange.subscribe((searchTerm: string) => {
         this.onSearchTermChange(searchTerm);
         
      });

   }

   // fetches and updates the channel data..
   getChannel() {
      this.docRef = doc(this.coll, this.channelId);
      this.channels$ = docData(this.docRef);
      this.channels$.subscribe(change => {
         this.channel = new Channel(change);
      });
   }


   // fetches and updates messages data, including answer counts, and listens for user collection changes
   async getMessages() {
      this.messagesRef = collection(this.docRef, 'messages');
      const messagesQuery = query(this.messagesRef, orderBy('timestamp'));
      this.messages$ = collectionData(messagesQuery, { idField: 'id' });
      this.messages$.subscribe(async (changes) => {
         this.allMessages = changes;
         this.updateFilteredMessages();
         for (const message of this.allMessages) {
            const answersQuery = collection(doc(this.messagesRef, message.id), 'answers');
            const answersSnapshot = await getDocs(answersQuery);
            const answersCount = answersSnapshot.size;
            message.answersCount = answersCount;
         }
      });

      onSnapshot(this.userColl, (snapshot) => {
         snapshot.docChanges().forEach((change) => {
            const user = change.doc.data() as User;
            const userId = change.doc.id;
            this.updateUserMessages(userId, user);
         });
      });
   }


   // updates user information for messages
   updateUserMessages(userId: string, user: User) {
      for (const message of this.allMessages) {
         if (message.userId === userId) {
            message.user = user.name;
            message.imagePath = user.profileImageUrl;
         }
      }
   }


   // fetches and updates user data
   getUser() {
      const userId = this.auth.userUID;
      this.userRef = doc(this.userColl, userId);
      this.userData$ = docData(this.userRef);
      this.userData$.subscribe(data => {
         this.user = data;
      });
   }


   @ViewChild('editor') editor: EditorComponent;


   // submits the form, adds the message, and clears the editor content
   onSubmit() {
      const content = this.editor.getContent();
      this.addMessage(content);
      this.editor.clearContent()
   }

   // adds a new message to the database and creates a subcollection for answers
   addMessage(content) {
      this.messagesRef = collection(doc(this.coll, this.channelId), 'messages');
      const message = new Message;
      message.message = content;
      message.user = this.user.name;
      message.imagePath = this.user.profileImageUrl;
      message.userId = this.auth.userUID;
      addDoc(this.messagesRef, message.toJSON()).then((docRef) => {
         // Create an empty subcollection for messages
         const answersColl = collection(this.firestore, `channels/${this.channelId}/messages/${docRef.id}/answers`);
         addDoc(answersColl, { 'default': 'Default document!' }); // Add an empty document to create the subcollection)
         this.updateFilteredMessages();
      });
   }

   
   // opens a thread by invoking a service with the channel ID and message ID
   openThread(channelId: any, messageId: any) {
      this.openThreadService.setThreadOpened(true, channelId, messageId);
   }


   // queries the database for answer counts and updates the messages accordingly.
   updateAnswersCount() {
      for (const message of this.allMessages) {
         const answersQuery = collection(doc(this.messagesRef, message.id), 'answers');
         getDocs(answersQuery).then((answersSnapshot) => {
            const answersCount = answersSnapshot.size;
            message.answersCount = answersCount;
         });
      }
   }


   // updates filteredMessages based on the search term, displaying all messages if the search term is empty or filtering messages by matching the term in the text or user name
   onSearchTermChange(searchTerm: string) {
      if (searchTerm.trim() === '') {
         this.filteredMessages = this.allMessages; 
      } else {
         searchTerm = searchTerm.toLowerCase();
         this.filteredMessages = this.allMessages.filter(message => {
            const messageText = message.message.toLowerCase();
            const userName = message.user.toLowerCase(); 
            return messageText.includes(searchTerm) || userName.includes(searchTerm);
         });
      }
   }


   // copies all messages from allMessages to filteredMessages.
   async updateFilteredMessages() {
      this.filteredMessages = [...this.allMessages];
   }


}